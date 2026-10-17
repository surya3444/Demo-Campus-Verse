import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function ensure(
  db: Db,
  collection: string,
  spec: Record<string, 1 | -1>,
  options: { name: string; unique?: boolean; sparse?: boolean } = { name: '' }
) {
  const indexName =
    options.name ||
    Object.entries(spec)
      .map(([k, v]) => `${k}_${v}`)
      .join('_');
  try {
    const created = await db
      .collection(collection)
      .createIndex(spec, { ...options, name: indexName });
    console.log(`  ✓ ${collection}: ${created}`);
  } catch (e) {
    console.error(`  ✗ ${collection}: ${indexName} —`, (e as Error).message);
  }
}

export async function createLiveClassIndexes(db: Db): Promise<void> {
  console.log('live_classes:');
  await ensure(
    db,
    'live_classes',
    { tenantId: 1, branchId: 1, scheduledStart: -1 },
    { name: 'tenant_branch_start' }
  );
  await ensure(
    db,
    'live_classes',
    { tenantId: 1, sectionId: 1, scheduledStart: -1 },
    { name: 'tenant_section_start' }
  );
  await ensure(
    db,
    'live_classes',
    { tenantId: 1, hostStaffId: 1, scheduledStart: -1 },
    { name: 'tenant_host_start' }
  );
  await ensure(
    db,
    'live_classes',
    { tenantId: 1, status: 1, scheduledStart: -1 },
    { name: 'tenant_status_start' }
  );

  console.log('\nlive_class_participants:');
  await ensure(
    db,
    'live_class_participants',
    { liveClassId: 1, userId: 1 },
    { name: 'class_user_unique', unique: true }
  );
  await ensure(
    db,
    'live_class_participants',
    { tenantId: 1, liveClassId: 1 },
    { name: 'tenant_class' }
  );
  // Used by the stale-participant janitor (P0-5) to find lingering rows.
  await ensure(
    db,
    'live_class_participants',
    { lastSeenAt: 1 },
    { name: 'last_seen', sparse: true }
  );

  console.log('\nlive_class_messages:');
  await ensure(
    db,
    'live_class_messages',
    { liveClassId: 1, createdAt: -1 },
    { name: 'class_created' }
  );
  await ensure(
    db,
    'live_class_messages',
    { tenantId: 1, liveClassId: 1 },
    { name: 'tenant_class' }
  );

  console.log('\nlive_class_polls:');
  await ensure(
    db,
    'live_class_polls',
    { liveClassId: 1, launchedAt: -1 },
    { name: 'class_launched' }
  );
  await ensure(
    db,
    'live_class_polls',
    { tenantId: 1, liveClassId: 1, status: 1 },
    { name: 'tenant_class_status' }
  );

  console.log('\nlive_class_poll_responses:');
  await ensure(
    db,
    'live_class_poll_responses',
    { pollId: 1, userId: 1 },
    { name: 'poll_user_unique', unique: true }
  );
  await ensure(
    db,
    'live_class_poll_responses',
    { liveClassId: 1, pollId: 1 },
    { name: 'class_poll' }
  );

  console.log('\nlive_class_whiteboard_snapshots:');
  await ensure(
    db,
    'live_class_whiteboard_snapshots',
    { liveClassId: 1, version: -1 },
    { name: 'class_version' }
  );
  await ensure(
    db,
    'live_class_whiteboard_snapshots',
    { tenantId: 1, liveClassId: 1 },
    { name: 'tenant_class' }
  );

  console.log('\nwebhook_events:');
  await ensure(
    db,
    'webhook_events',
    { source: 1, eventId: 1 },
    { name: 'source_event_unique', unique: true }
  );
  await ensure(db, 'webhook_events', { receivedAt: 1 }, { name: 'received_ttl' });
}

// CLI entrypoint — when run directly, open a Mongo connection and invoke the
// builder. The orchestrator at infrastructure/scripts/create-indexes.ts uses
// the named export above.
if (require.main === module) {
  const URI = process.env.MONGODB_URI;
  (async () => {
    if (!URI) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    const client = new MongoClient(URI);
    await client.connect();
    const db = client.db();
    console.log(`DB: ${db.databaseName}\n`);
    await createLiveClassIndexes(db);
    console.log('\nDone.');
    await client.close();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
