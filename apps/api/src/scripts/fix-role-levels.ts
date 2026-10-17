/**
 * One-time migration script to fix role levels and clean up deprecated roles
 * Run with: npx tsx src/scripts/fix-role-levels.ts
 */
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const ROLE_HIERARCHY: Record<string, number> = {
  GROUP_OWNER: 0,
  ORG_MODERATOR: 1,
  ORG_ADMIN: 2,
  BRANCH_ADMIN: 3,
};

// Deprecated roles to be cleaned up
const DEPRECATED_ROLES = ['BRANCH_SUPER_ADMIN'];

// ORG_ADMIN permissions
const ORG_ADMIN_PERMISSIONS: Record<string, string[]> = {
  'organization.branches': ['view'],
  'organization.users': ['view', 'create', 'edit', 'delete', 'reset-password'],
  'organization.roles': ['view'],
  'organization.settings': ['view'],
  'students.list': ['view', 'create', 'edit', 'delete', 'bulk-upload', 'export'],
  'students.details': ['view', 'edit'],
  'students.enrollment': ['view', 'create', 'edit'],
  'students.promotion': ['view', 'create'],
  'admissions.leads': ['view', 'create', 'edit', 'delete', 'assign', 'convert'],
  'admissions.applications': ['view', 'create', 'edit', 'approve', 'reject', 'enroll'],
  'admissions.settings': ['view', 'edit'],
  'finance.feeCounter': ['view', 'collect', 'cancel', 'refund'],
  'finance.feeStructures': ['view', 'create', 'edit', 'delete'],
  'finance.collections': ['view', 'export'],
  'finance.dues': ['view', 'export'],
  'finance.concessions': ['view', 'create', 'approve', 'reject'],
  'finance.reports': ['view', 'export'],
  'finance.settings': ['view', 'edit'],
  'attendance.mark': ['view', 'create', 'edit'],
  'attendance.view': ['view'],
  'attendance.reports': ['view', 'export'],
  'attendance.settings': ['view', 'edit'],
  'hr.staff': ['view', 'create', 'edit', 'delete'],
  'hr.attendance': ['view', 'create', 'edit'],
  'hr.leaves': ['view', 'create', 'approve', 'reject'],
  'hr.workload': ['view', 'create', 'edit'],
  'hr.settings': ['view', 'edit'],
  'communications.sms': ['view', 'send'],
  'communications.announcements': ['view', 'create', 'edit', 'delete', 'publish'],
  'communications.calendar': ['view', 'create', 'edit', 'delete'],
  'communications.settings': ['view', 'edit'],
  'dashboard.branchView': ['view'],
  'reports.view': ['view'],
  'reports.export': ['export'],
};

// BRANCH_ADMIN permissions
const BRANCH_ADMIN_PERMISSIONS: Record<string, string[]> = {
  'organization.users': ['view'],
  'students.list': ['view', 'create', 'edit', 'bulk-upload', 'export'],
  'students.details': ['view', 'edit'],
  'students.enrollment': ['view', 'create', 'edit'],
  'students.promotion': ['view', 'create'],
  'admissions.leads': ['view', 'create', 'edit', 'assign', 'convert'],
  'admissions.applications': ['view', 'create', 'edit', 'approve', 'reject', 'enroll'],
  'finance.feeCounter': ['view', 'collect'],
  'finance.feeStructures': ['view'],
  'finance.collections': ['view', 'export'],
  'finance.dues': ['view', 'export'],
  'finance.concessions': ['view', 'create'],
  'finance.reports': ['view', 'export'],
  'attendance.mark': ['view', 'create', 'edit'],
  'attendance.view': ['view'],
  'attendance.reports': ['view', 'export'],
  'hr.staff': ['view', 'create', 'edit'],
  'hr.attendance': ['view', 'create', 'edit'],
  'hr.leaves': ['view', 'create', 'approve', 'reject'],
  'hr.workload': ['view', 'create', 'edit'],
  'communications.sms': ['view', 'send'],
  'communications.announcements': ['view', 'create', 'edit', 'publish'],
  'communications.calendar': ['view', 'create', 'edit'],
  'dashboard.branchView': ['view'],
  'reports.view': ['view'],
  'reports.export': ['export'],
};

async function fixRoleLevels() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const rolesCollection = db.collection('roles');
    const usersCollection = db.collection('users');

    // Get current state of system roles
    const systemRoles = await rolesCollection.find({ isSystemRole: true }).toArray();
    console.log('\nCurrent system roles:');
    systemRoles.forEach(role => {
      console.log(`  ${role.code}: level ${role.level}`);
    });

    // Ensure all 4 system roles exist for each tenant
    console.log('\nEnsuring all system roles exist...');
    const tenants = await db.collection('tenants').find({}).toArray();

    for (const tenant of tenants) {
      const tenantId = tenant._id;

      for (const [code, level] of Object.entries(ROLE_HIERARCHY)) {
        const existingRole = await rolesCollection.findOne({ tenantId, code });
        if (!existingRole) {
          const roleNames: Record<string, string> = {
            GROUP_OWNER: 'Group Owner',
            ORG_MODERATOR: 'Org Moderator',
            ORG_ADMIN: 'Org Admin',
            BRANCH_ADMIN: 'Branch Admin',
          };
          const roleDescriptions: Record<string, string> = {
            GROUP_OWNER: 'Full control over the group and all organizations',
            ORG_MODERATOR: 'Same access as owner, cannot manage other moderators',
            ORG_ADMIN: 'Admin access to a single organization',
            BRANCH_ADMIN: 'Admin access to a single branch',
          };

          // Get permissions based on role type
          const fullAccessRole = await rolesCollection.findOne({ tenantId, code: 'GROUP_OWNER' });
          let permissions: Record<string, string[]> = {};
          if (code === 'GROUP_OWNER' || code === 'ORG_MODERATOR') {
            permissions = fullAccessRole?.permissions || {};
          } else if (code === 'ORG_ADMIN') {
            permissions = ORG_ADMIN_PERMISSIONS;
          } else if (code === 'BRANCH_ADMIN') {
            permissions = BRANCH_ADMIN_PERMISSIONS;
          }

          await rolesCollection.insertOne({
            tenantId,
            name: roleNames[code],
            code,
            description: roleDescriptions[code],
            isSystemRole: true,
            level,
            permissions,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`  Created ${code} role for tenant ${tenant.name || tenantId}`);
        }
      }
    }

    // Clean up deprecated roles
    console.log('\nCleaning up deprecated roles...');
    for (const deprecatedCode of DEPRECATED_ROLES) {
      // Find all deprecated roles
      const deprecatedRoles = await rolesCollection.find({ code: deprecatedCode }).toArray();

      for (const deprecatedRole of deprecatedRoles) {
        // Find the ORG_ADMIN role to migrate users to
        const orgAdminRole = await rolesCollection.findOne({
          code: 'ORG_ADMIN',
          tenantId: deprecatedRole.tenantId
        });

        if (orgAdminRole) {
          // Migrate users from deprecated role to ORG_ADMIN
          const userMigration = await usersCollection.updateMany(
            { roleId: deprecatedRole._id },
            {
              $set: {
                roleId: orgAdminRole._id,
                roleCode: 'ORG_ADMIN',
                roleLevel: ROLE_HIERARCHY['ORG_ADMIN']
              }
            }
          );
          if (userMigration.modifiedCount > 0) {
            console.log(`  Migrated ${userMigration.modifiedCount} user(s) from ${deprecatedCode} to ORG_ADMIN`);
          }
        }
      }

      // Delete the deprecated roles
      const deleteResult = await rolesCollection.deleteMany({ code: deprecatedCode });
      if (deleteResult.deletedCount > 0) {
        console.log(`  Deleted ${deleteResult.deletedCount} ${deprecatedCode} role(s)`);
      }
    }

    // Fix roles
    console.log('\nUpdating role levels...');
    for (const [code, level] of Object.entries(ROLE_HIERARCHY)) {
      const result = await rolesCollection.updateMany(
        { code, level: { $ne: level } },
        { $set: { level, updatedAt: new Date() } }
      );
      if (result.modifiedCount > 0) {
        console.log(`  Updated ${result.modifiedCount} ${code} role(s) to level ${level}`);
      }
    }

    // Update permissions for ORG_ADMIN and BRANCH_ADMIN roles
    console.log('\nUpdating role permissions...');

    // Update ORG_ADMIN permissions
    const orgAdminUpdate = await rolesCollection.updateMany(
      { code: 'ORG_ADMIN', isSystemRole: true },
      { $set: { permissions: ORG_ADMIN_PERMISSIONS, updatedAt: new Date() } }
    );
    if (orgAdminUpdate.modifiedCount > 0) {
      console.log(`  Updated permissions for ${orgAdminUpdate.modifiedCount} ORG_ADMIN role(s)`);
    }

    // Update BRANCH_ADMIN permissions
    const branchAdminUpdate = await rolesCollection.updateMany(
      { code: 'BRANCH_ADMIN', isSystemRole: true },
      { $set: { permissions: BRANCH_ADMIN_PERMISSIONS, updatedAt: new Date() } }
    );
    if (branchAdminUpdate.modifiedCount > 0) {
      console.log(`  Updated permissions for ${branchAdminUpdate.modifiedCount} BRANCH_ADMIN role(s)`);
    }

    // Fix user roleLevel fields
    console.log('\nUpdating user role levels...');
    for (const [code, level] of Object.entries(ROLE_HIERARCHY)) {
      const result = await usersCollection.updateMany(
        { roleCode: code, roleLevel: { $ne: level } },
        { $set: { roleLevel: level } }
      );
      if (result.modifiedCount > 0) {
        console.log(`  Updated ${result.modifiedCount} user(s) with ${code} to roleLevel ${level}`);
      }
    }

    // Verify final state
    const updatedRoles = await rolesCollection.find({ isSystemRole: true }).toArray();
    console.log('\nFinal system roles:');
    updatedRoles.forEach(role => {
      console.log(`  ${role.code}: level ${role.level}`);
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

fixRoleLevels();
