/**
 * Demo platform, phase 21b: offers accepted before profiles existed never
 * marked the student placed. Record each accepted offer on the student's
 * career profile (creating the profile if needed) — the same thing the offer
 * flow now does on acceptance. Scoped to one tenant.
 *
 * Run (from apps/api): npx tsx src/scripts/demo-platform/21b-placements-backfill.ts <tenantId>
 */
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, collections } from '../../config/database';
import { studentProfileService } from '../../modules/career-connect/studentProfile/studentProfile.service';

(async () => {
  const id = process.argv[2];
  if (!id || !ObjectId.isValid(id)) throw new Error('Pass the tenant id');
  await connectDatabase();
  const tenantId = new ObjectId(id);
  const accepted = await collections.placementOffers.find({ tenantId, status: 'accepted' }).toArray();
  let n = 0;
  for (const o of accepted) {
    await studentProfileService.getOrCreateProfile(id, String(o.studentId), '');
    await collections.studentCareerProfiles.updateOne(
      { tenantId, studentId: o.studentId },
      {
        $set: {
          placementStatus: 'placed',
          placement: { offerId: String(o._id), company: o.companyName, role: o.role, ctc: o.ctc, location: o.location ?? null, acceptedAt: o.respondedAt ?? o.updatedAt },
          updatedAt: new Date(),
        },
      }
    );
    n++;
  }
  // Everyone else is 'unplaced' (the only valid value besides opted_out/higher_studies);
  // older profiles were created with an invalid 'not_placed'.
  const regs = new Set(
    (await collections.placementDrives.find({ tenantId }).project({ registrations: 1 }).toArray()).flatMap((d) =>
      (d.registrations ?? []).map((r: { studentId: ObjectId }) => String(r.studentId))
    )
  );
  const placed = new Set(accepted.map((o) => String(o.studentId)));
  const looking = [...regs].filter((s) => !placed.has(s)).map((s) => new ObjectId(s));
  const r = await collections.studentCareerProfiles.updateMany(
    { tenantId, placementStatus: { $nin: ['placed', 'opted_out', 'higher_studies'] } },
    { $set: { placementStatus: 'unplaced' } }
  );
  console.log(`placed ${n}, unplaced ${r.modifiedCount} (of ${looking.length} still looking)`);
  await closeDatabase();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
