/**
 * Migrate college/university branches that are still sitting on the UNTOUCHED
 * CBSE exam defaults over to the UGC 10-point preset.
 *
 * Exam settings used to auto-seed with CBSE for everyone. That matters beyond
 * labelling: `band.points` feeds credit-weighted SGPA/CGPA, and the two scales
 * disagree at the pass boundary — CBSE awards 4 points (a pass) from 33%,
 * while UGC fails anything under 40. A university left on CBSE therefore
 * passes students its own regulations would fail.
 *
 * SAFETY: only branches whose settings still match the CBSE preset EXACTLY are
 * migrated. Any customisation — an edited band, a changed pass mark, a
 * different preset already chosen — is treated as deliberate and left alone.
 *
 * Idempotent. Dry-run by default; pass --apply to write.
 *
 * Usage:
 *   pnpm --filter @campus-verse/api exec tsx infrastructure/scripts/migrate-university-exam-preset.ts
 *   ... --apply
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  BOARD_PRESET_CONFIG,
  CBSE_GRADING_SCALE,
  type GradingScaleBand,
} from '../../packages/shared/src/constants/exam';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI;
const APPLY = process.argv.includes('--apply');

/** Deep-equal on the fields that define a grading scale. */
function sameScale(a: GradingScaleBand[] = [], b: GradingScaleBand[] = []): boolean {
  if (a.length !== b.length) return false;
  return a.every((band, i) => {
    const other = b[i];
    return (
      band.minPercent === other.minPercent &&
      band.maxPercent === other.maxPercent &&
      band.grade === other.grade &&
      (band.points ?? null) === (other.points ?? null)
    );
  });
}

(async () => {
  if (!URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  console.log(
    `Connected to ${db.databaseName}${APPLY ? '' : ' (dry run — pass --apply to write)'}\n`
  );

  // Branches belonging to a college or university.
  const branches = await db
    .collection('branches')
    .find({ institutionType: { $in: ['college', 'university'] } })
    .project({ _id: 1, tenantId: 1, name: 1, institutionType: 1 })
    .toArray();

  console.log(`college/university branches: ${branches.length}\n`);

  const ugc = BOARD_PRESET_CONFIG.ugc;
  let migrated = 0;
  let customised = 0;
  let noSettings = 0;
  let alreadyUgc = 0;

  for (const b of branches) {
    const settings = await db.collection('exam_settings').findOne({
      tenantId: b.tenantId as ObjectId,
      branchId: b._id as ObjectId,
    });

    if (!settings) {
      // Nothing stored yet — it will seed as UGC on first read now.
      noSettings++;
      continue;
    }
    if (settings.boardPreset === 'ugc') {
      alreadyUgc++;
      continue;
    }

    const untouched =
      settings.boardPreset === 'cbse' &&
      settings.passMarkPercent === 33 &&
      sameScale(settings.gradingScale as GradingScaleBand[], CBSE_GRADING_SCALE);

    if (!untouched) {
      customised++;
      console.log(
        `  – ${b.name}: left alone (preset=${settings.boardPreset}, ` +
          `passMark=${settings.passMarkPercent}, scale ${
            sameScale(settings.gradingScale as GradingScaleBand[], CBSE_GRADING_SCALE)
              ? 'stock'
              : 'edited'
          })`
      );
      continue;
    }

    if (APPLY) {
      await db.collection('exam_settings').updateOne(
        { _id: settings._id },
        {
          $set: {
            boardPreset: 'ugc',
            gradingScale: ugc.gradingScale,
            coScholasticEnabled: ugc.coScholasticEnabled,
            coScholasticAreas: ugc.coScholasticAreas,
            passMarkPercent: ugc.passMarkPercent,
            updatedAt: new Date(),
          },
        }
      );
    }
    migrated++;
    console.log(`  ✓ ${b.name} (${b.institutionType}) — CBSE → UGC`);
  }

  console.log(
    `\nDone. migrated=${migrated}${APPLY ? '' : ' (not written)'} ` +
      `customised=${customised} alreadyUgc=${alreadyUgc} noSettingsYet=${noSettings}`
  );
  if (noSettings > 0) {
    console.log(`(${noSettings} branch(es) have no exam settings — they will seed as UGC.)`);
  }
  await client.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
