// Phase 16 — staff accounts were created with a temporary-password flag, so
// every demo login opened "Change your password". Each account changes its
// password to the same shared one through the real endpoint, which clears it.
import { session, pool, loadState, log, PASSWORD } from './lib.mjs';
import { ORGS } from './spec.mjs';

const staff = ORGS.filter((o) => !process.argv[2] || o.key === process.argv[2]).flatMap((o) => Object.values(loadState(o.key).campuses ?? {}).flatMap((c) => c.staff ?? []))
  .filter((s) => s.email && s.role !== 'STAFF (no login)' && s.email !== 'cvdemo-aranya-ablr-admin@yopmail.com');
let cleared = 0, skipped = 0, failed = 0;
await pool(staff, 6, async (s) => {
  try {
    const me = await session(s.email);
    const u = me.user();
    if (!(u?.mustChangePassword ?? u?.security?.mustChangePassword)) return skipped++;
    await me.call('POST', '/auth/change-password', { currentPassword: PASSWORD, newPassword: PASSWORD, confirmPassword: PASSWORD });
    cleared++;
  } catch (e) {
    failed++;
    if (failed < 5) log('  ', s.email, e.message.slice(0, 140));
  }
  if ((cleared + skipped + failed) % 100 === 0) log(`  ${cleared + skipped + failed}/${staff.length}`);
});
log(`phase 16 done: ${cleared} cleared, ${skipped} already fine, ${failed} failed`);
