/**
 * One-time migration script to add default operational roles to existing tenants.
 * Idempotent — skips roles that already exist for a tenant.
 *
 * Run with: npx tsx src/scripts/seed-default-roles.ts
 */
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

const DEFAULT_ROLES = [
  {
    name: 'Teacher',
    code: 'TEACHER',
    description: 'Classroom-level access for marking attendance and viewing students',
    level: 10,
    permissions: {
      'students.list': ['view'],
      'students.details': ['view'],
      'students.reports': ['view'],
      'attendance.mark': ['view', 'create', 'edit'],
      'attendance.view': ['view'],
      'attendance.reports': ['view', 'export'],
      'communications.announcements': ['view'],
      'communications.calendar': ['view'],
      'health.records': ['view'],
      'dashboard.branchView': ['view'],
    } as Record<string, string[]>,
  },
  {
    name: 'Admission Counselor',
    code: 'ADMISSION_COUNSELOR',
    description: 'Full access to leads and applications in the admission pipeline',
    level: 10,
    permissions: {
      'admissions.leads': ['view', 'create', 'edit', 'assign', 'convert'],
      'admissions.applications': ['view', 'create', 'edit', 'approve', 'reject', 'enroll'],
      'admissions.reports': ['view', 'export'],
      'students.list': ['view'],
      'students.details': ['view'],
      'communications.announcements': ['view', 'create'],
      'communications.calendar': ['view'],
      'dashboard.branchView': ['view'],
    } as Record<string, string[]>,
  },
  {
    name: 'Accountant',
    code: 'ACCOUNTANT',
    description: 'Finance operations including fee collection, reports, and concessions',
    level: 10,
    permissions: {
      'finance.feeCounter': ['view', 'collect', 'cancel', 'refund'],
      'finance.feeStructures': ['view'],
      'finance.collections': ['view', 'export'],
      'finance.dues': ['view', 'export'],
      'finance.concessions': ['view', 'create'],
      'finance.reports': ['view', 'export'],
      'finance.structures': ['view'],
      'finance.assignments': ['view'],
      'finance.transactions': ['view', 'create'],
      'finance.wallets': ['view'],
      'students.list': ['view'],
      'students.details': ['view'],
      'dashboard.branchView': ['view'],
      'reports.view': ['view'],
      'reports.export': ['export'],
    } as Record<string, string[]>,
  },
  {
    name: 'HR Manager',
    code: 'HR_MANAGER',
    description: 'Staff management, HR attendance, leave approvals, and workload tracking',
    level: 10,
    permissions: {
      'hr.staff': ['view', 'create', 'edit'],
      'hr.attendance': ['view', 'create', 'edit'],
      'hr.leaves': ['view', 'create', 'approve', 'reject'],
      'hr.workload': ['view', 'create', 'edit'],
      'hr.settings': ['view'],
      'communications.announcements': ['view', 'create'],
      'communications.calendar': ['view'],
      'dashboard.branchView': ['view'],
      'reports.view': ['view'],
    } as Record<string, string[]>,
  },
  {
    name: 'Receptionist',
    code: 'RECEPTIONIST',
    description:
      'Front desk operations with view access to students, attendance, and health visits',
    level: 15,
    permissions: {
      'students.list': ['view'],
      'students.details': ['view'],
      'attendance.view': ['view'],
      'communications.announcements': ['view'],
      'communications.calendar': ['view'],
      'health.records': ['view'],
      'health.visits': ['view', 'create'],
      'certificates.requests': ['view'],
      'dashboard.branchView': ['view'],
    } as Record<string, string[]>,
  },
];

async function seedDefaultRoles() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db();
    const rolesCollection = db.collection('roles');
    const tenants = await db.collection('tenants').find({}).toArray();

    console.log(`Found ${tenants.length} tenant(s)\n`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
      const tenantId = tenant._id;
      const tenantName = tenant.name || tenantId.toString();
      console.log(`Tenant: ${tenantName}`);

      for (const role of DEFAULT_ROLES) {
        const exists = await rolesCollection.findOne({ tenantId, code: role.code });
        if (exists) {
          console.log(`  ✓ ${role.code} already exists — skipped`);
          totalSkipped++;
          continue;
        }

        await rolesCollection.insertOne({
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
        });
        console.log(`  + ${role.code} created`);
        totalCreated++;
      }

      console.log('');
    }

    console.log('─'.repeat(40));
    console.log(`Created: ${totalCreated} role(s)`);
    console.log(`Skipped: ${totalSkipped} role(s) (already existed)`);
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedDefaultRoles();
