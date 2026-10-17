/**
 * Demo platform, step 1: approve the demo organisation signups (the Super
 * Admin console's approve action, called directly) on the Enterprise plan with
 * every module, then lift the staff cap so ~100 staff per institution fits.
 *
 * Run: npx tsx src/scripts/demo-platform/approve-signups.ts <signupId>...
 */
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../../config/database';
import { adminService } from '../../modules/admin/admin.service';
import { CORE_MODULES, OPTIONAL_MODULES } from '@campus-verse/shared/constants';

(async () => {
  await connectDatabase();
  const signupIds = process.argv.slice(2);
  const approver = await collections.superAdmins.findOne({}, { projection: { _id: 1 } });
  if (!approver) throw new Error('No super admin exists to record as approver');
  const modules = [...CORE_MODULES, ...OPTIONAL_MODULES];
  for (const id of signupIds) {
    const signup = await collections.organizationSignups.findOne({ _id: new ObjectId(id) });
    if (signup?.status !== 'approved') {
      await adminService.approveOrganization(id, approver._id.toString(), modules, 'enterprise');
    }
    const tenant = await collections.tenants.findOne({ 'contact.email': signup?.admin.email });
    await collections.tenants.updateOne(
      { _id: tenant!._id },
      {
        $set: {
          'subscription.maxStaff': 2000,
          'subscription.maxStudents': 20000,
          'subscription.validUntil': new Date(Date.now() + 365 * 86_400_000),
          demo: true,
        },
      }
    );
    console.log(`${signup?.organizationName} → tenant ${tenant!._id} (${tenant!.code})`);
  }
  await closeDatabase();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
