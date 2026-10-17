import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  ROLE_HIERARCHY,
  DEFAULT_ROLES,
  MODULES,
} from '@campus-verse/shared';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus_verse';

async function seed() {
  console.log('🌱 Starting database seed...');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log('📦 Connected to MongoDB');

    // Create indexes
    console.log('📇 Creating indexes...');
    await createIndexes(db);

    // Check if data already exists
    const existingTenant = await db.collection('tenants').findOne({});
    if (existingTenant) {
      console.log('⚠️  Database already seeded. Skipping...');
      return;
    }

    // Create tenant
    console.log('🏢 Creating tenant...');
    const tenantId = new ObjectId();
    const tenant = {
      _id: tenantId,
      tenantId: tenantId.toString(), // Self-reference for BaseEntity compatibility
      name: 'Demo Institution Group',
      code: 'DEMO',
      institutionTypes: ['school', 'college'],
      contact: {
        email: 'admin@demo-campus.com',
        phone: '+91-9876543210',
        address: {
          line1: '123 Education Street',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          pincode: '560001',
        },
      },
      legalInfo: {
        entityName: 'Demo Education Pvt Ltd',
        gstNumber: 'GST123456789',
        panNumber: 'ABCDE1234F',
      },
      branding: {
        primaryColor: '#4F46E5',
        secondaryColor: '#818CF8',
      },
      subscription: {
        plan: 'enterprise',
        maxBranches: 10,
        maxStudents: 10000,
        maxStaff: 500,
        features: Object.keys(MODULES),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
      settings: {
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        currency: 'INR',
        fiscalYearStart: '04-01',
      },
      onboardingCompleted: false,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection('tenants').insertOne(tenant);

    // Create branches
    console.log('🏫 Creating branches...');
    const branch1Id = new ObjectId();
    const branch2Id = new ObjectId();

    const branches = [
      {
        _id: branch1Id,
        tenantId,
        branchId: branch1Id.toString(),
        name: 'Demo School - Main Campus',
        code: 'DMS-MC',
        institutionType: 'school',
        location: {
          state: 'Karnataka',
          city: 'Bangalore',
          address: {
            line1: '123 School Road',
            city: 'Bangalore',
            state: 'Karnataka',
            country: 'India',
            pincode: '560001',
          },
        },
        contact: {
          email: 'school@demo-campus.com',
          phone: '+91-9876543211',
        },
        infrastructure: {
          hasHostel: true,
          hasTransport: true,
          hasCanteen: true,
          hasLibrary: true,
          hasLab: true,
        },
        settings: {
          weeklyOff: ['sunday'],
          workingHours: { start: '08:00', end: '16:00' },
          attendanceTime: { start: '08:00', lateAfter: '08:30', end: '16:00' },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: branch2Id,
        tenantId,
        branchId: branch2Id.toString(),
        name: 'Demo College - City Campus',
        code: 'DMC-CC',
        institutionType: 'college',
        location: {
          state: 'Karnataka',
          city: 'Bangalore',
          address: {
            line1: '456 College Avenue',
            city: 'Bangalore',
            state: 'Karnataka',
            country: 'India',
            pincode: '560002',
          },
        },
        contact: {
          email: 'college@demo-campus.com',
          phone: '+91-9876543212',
        },
        infrastructure: {
          hasHostel: false,
          hasTransport: true,
          hasCanteen: true,
          hasLibrary: true,
          hasLab: true,
        },
        settings: {
          weeklyOff: ['saturday', 'sunday'],
          workingHours: { start: '09:00', end: '17:00' },
          attendanceTime: { start: '09:00', lateAfter: '09:30', end: '17:00' },
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    await db.collection('branches').insertMany(branches);

    // Create roles
    console.log('👑 Creating roles...');
    const roleIds: Record<string, ObjectId> = {};
    const { ORG_ADMIN_PERMISSIONS, BRANCH_ADMIN_PERMISSIONS } =
      await import('@campus-verse/shared/constants');

    const roles = [
      {
        _id: new ObjectId(),
        tenantId,
        name: 'Group Owner',
        code: SYSTEM_ROLES.GROUP_OWNER,
        description: 'Group owner with full control',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.GROUP_OWNER],
        permissions: PERMISSIONS,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        tenantId,
        name: 'Org Moderator',
        code: SYSTEM_ROLES.ORG_MODERATOR,
        description: 'Same access as owner, but cannot create/edit other moderators',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_MODERATOR],
        permissions: PERMISSIONS,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        tenantId,
        name: 'Org Admin',
        code: SYSTEM_ROLES.ORG_ADMIN,
        description: 'Admin access to a single organization',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.ORG_ADMIN],
        permissions: ORG_ADMIN_PERMISSIONS,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        tenantId,
        name: 'Branch Admin',
        code: SYSTEM_ROLES.BRANCH_ADMIN,
        description: 'Admin access to a single branch',
        isSystemRole: true,
        level: ROLE_HIERARCHY[SYSTEM_ROLES.BRANCH_ADMIN],
        permissions: BRANCH_ADMIN_PERMISSIONS,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.collection('roles').insertMany(roles);
    roles.forEach((role) => {
      roleIds[role.code] = role._id;
    });

    // Create default operational roles
    const defaultRoles = DEFAULT_ROLES.map((role) => ({
      _id: new ObjectId(),
      tenantId,
      name: role.name,
      code: role.code,
      description: role.description,
      isSystemRole: false,
      level: role.level,
      permissions: { ...role.permissions },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.collection('roles').insertMany(defaultRoles);
    defaultRoles.forEach((role) => {
      roleIds[role.code] = role._id;
    });

    // Create users
    console.log('👤 Creating users...');
    const passwordHash = await bcrypt.hash('Admin@123', 12);

    const users = [
      {
        _id: new ObjectId(),
        tenantId,
        email: 'admin@demo-campus.com',
        passwordHash,
        phone: '+91-9876543210',
        profile: {
          firstName: 'Super',
          lastName: 'Admin',
          displayName: 'Super Admin',
        },
        roleId: roleIds[SYSTEM_ROLES.GROUP_OWNER],
        accessScope: {
          type: 'global',
          branchIds: [],
        },
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            sms: true,
            push: true,
          },
        },
        status: 'active',
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        tenantId,
        email: 'school.admin@demo-campus.com',
        passwordHash,
        phone: '+91-9876543211',
        profile: {
          firstName: 'School',
          lastName: 'Admin',
          displayName: 'School Admin',
        },
        roleId: roleIds[SYSTEM_ROLES.BRANCH_ADMIN],
        accessScope: {
          type: 'branch',
          branchIds: [branch1Id],
        },
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            sms: true,
            push: true,
          },
        },
        status: 'active',
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        tenantId,
        email: 'orgadmin@demo-campus.com',
        passwordHash,
        phone: '+91-9876543213',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John Doe',
        },
        roleId: roleIds[SYSTEM_ROLES.ORG_ADMIN],
        accessScope: {
          type: 'global',
          branchIds: [],
        },
        preferences: {
          language: 'en',
          notifications: {
            email: true,
            sms: true,
            push: true,
          },
        },
        status: 'active',
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.collection('users').insertMany(users);

    // Create academic batch
    console.log('📅 Creating academic batch...');
    const batchId = new ObjectId();
    const academicBatch = {
      _id: batchId,
      tenantId,
      name: 'Academic Year 2024-25',
      code: 'AY2024-25',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2025-03-31'),
      isCurrent: true,
      terms: [
        {
          name: 'Term 1',
          startDate: new Date('2024-04-01'),
          endDate: new Date('2024-09-30'),
        },
        {
          name: 'Term 2',
          startDate: new Date('2024-10-01'),
          endDate: new Date('2025-03-31'),
        },
      ],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection('academic_batches').insertOne(academicBatch);

    // Create sample settings
    console.log('⚙️  Creating settings...');
    const settings = [
      {
        _id: new ObjectId(),
        tenantId,
        branchId: branch1Id,
        module: 'attendance',
        config: {
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          holidays: [],
          lateMarkGracePeriod: 15,
          halfDayThreshold: 4,
          autoAbsentMark: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        tenantId,
        branchId: branch1Id,
        module: 'finance',
        config: {
          feeReminderDays: [7, 3, 1],
          lateFeePercentage: 5,
          lateFeeGraceDays: 7,
          receiptPrefix: 'RCP',
          receiptNumberPadding: 6,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    await db.collection('settings').insertMany(settings);

    // Create counter for ID generation
    console.log('🔢 Creating counters...');
    await db.collection('counters').insertMany([
      { _id: 'student_id' as unknown as ObjectId, tenantId, sequence: 0 },
      { _id: 'staff_id' as unknown as ObjectId, tenantId, sequence: 0 },
      { _id: 'receipt_number' as unknown as ObjectId, tenantId, sequence: 0 },
      { _id: 'application_id' as unknown as ObjectId, tenantId, sequence: 0 },
    ]);

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Demo Accounts:');
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ Role          │ Email                          │');
    console.log('├─────────────────────────────────────────────────┤');
    console.log('│ Super Admin   │ admin@demo-campus.com          │');
    console.log('│ Branch Admin  │ school.admin@demo-campus.com   │');
    console.log('│ Principal     │ principal@demo-campus.com      │');
    console.log('│ Teacher       │ teacher@demo-campus.com        │');
    console.log('├─────────────────────────────────────────────────┤');
    console.log('│ Password (all): Admin@123                      │');
    console.log('└─────────────────────────────────────────────────┘');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

async function createIndexes(db: ReturnType<MongoClient['db']>) {
  // Tenants
  await db
    .collection('tenants')
    .createIndexes([{ key: { code: 1 }, unique: true }, { key: { status: 1 } }]);

  // Branches
  await db
    .collection('branches')
    .createIndexes([
      { key: { tenantId: 1, code: 1 }, unique: true },
      { key: { tenantId: 1, status: 1 } },
      { key: { tenantId: 1, institutionType: 1 } },
    ]);

  // Users
  await db.collection('users').createIndexes([
    { key: { tenantId: 1, email: 1 }, unique: true }, // Allow same email across tenants
    { key: { email: 1 } }, // Non-unique index for email lookups
    { key: { tenantId: 1, status: 1 } },
    { key: { tenantId: 1, roleId: 1 } },
    { key: { 'accessScope.branchIds': 1 } },
  ]);

  // Roles
  await db
    .collection('roles')
    .createIndexes([
      { key: { tenantId: 1, code: 1 }, unique: true },
      { key: { tenantId: 1, isSystemRole: 1 } },
    ]);

  // Academic Batches
  await db
    .collection('academic_batches')
    .createIndexes([
      { key: { tenantId: 1, code: 1 }, unique: true },
      { key: { tenantId: 1, isCurrent: 1 } },
      { key: { tenantId: 1, status: 1 } },
    ]);

  // Students
  await db
    .collection('students')
    .createIndexes([
      { key: { tenantId: 1, branchId: 1, studentId: 1 }, unique: true },
      { key: { tenantId: 1, status: 1 } },
      { key: { 'personal.email': 1 }, sparse: true },
      { key: { 'personal.phone': 1 }, sparse: true },
    ]);

  // Audit Logs
  await db
    .collection('audit_logs')
    .createIndexes([
      { key: { tenantId: 1, timestamp: -1 } },
      { key: { tenantId: 1, userId: 1, timestamp: -1 } },
      { key: { tenantId: 1, action: 1 } },
    ]);

  // Settings
  await db
    .collection('settings')
    .createIndexes([{ key: { tenantId: 1, branchId: 1, module: 1 }, unique: true }]);

  // Transport
  await db
    .collection('transport_buses')
    .createIndexes([
      { key: { tenantId: 1, branchId: 1, busNumber: 1 }, unique: true },
      { key: { tenantId: 1, branchId: 1, status: 1 } },
      { key: { tenantId: 1, branchId: 1, 'pricing.mode': 1 } },
    ]);

  await db
    .collection('transport_enrollments')
    .createIndexes([
      { key: { tenantId: 1, branchId: 1, busId: 1, status: 1 } },
      { key: { tenantId: 1, studentId: 1, status: 1 } },
      { key: { tenantId: 1, branchId: 1, stopId: 1 } },
    ]);

  await db
    .collection('transport_settings')
    .createIndexes([{ key: { tenantId: 1, branchId: 1 }, unique: true }]);
}

// Run seed
seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
