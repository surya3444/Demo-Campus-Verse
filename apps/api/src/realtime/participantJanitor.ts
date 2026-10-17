import { collections } from '../config/database';
import { logger } from '../lib/logger';

// Mark participants as left if their socket-side heartbeat hasn't updated
// `lastSeenAt` in this many ms. Heartbeats fire every 30s (see liveClass
// handlers), so 5 minutes covers a few missed beats without churning.
const STALE_AFTER_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

let timer: NodeJS.Timeout | null = null;

async function sweep(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  try {
    const result = await collections.liveClassParticipants.updateMany(
      {
        leftAt: { $exists: false },
        lastSeenAt: { $lt: cutoff },
      },
      [
        // Pipeline form so we can copy lastSeenAt → leftAt instead of using
        // wall-clock now() (which would over-credit time the user wasn't
        // actually present for).
        { $set: { leftAt: '$lastSeenAt' } },
      ]
    );
    if (result.modifiedCount > 0) {
      logger.info(
        { swept: result.modifiedCount, cutoff },
        'participant janitor: marked stale participants as left'
      );
    }
  } catch (err) {
    logger.error({ err }, 'participant janitor sweep failed');
  }
}

export function startParticipantJanitor(): void {
  if (timer) return;
  timer = setInterval(() => {
    void sweep();
  }, SWEEP_INTERVAL_MS);
  // Don't keep the event loop alive solely for the janitor.
  timer.unref?.();
  logger.info(
    { intervalMs: SWEEP_INTERVAL_MS, staleAfterMs: STALE_AFTER_MS },
    'participant janitor started'
  );
}

export function stopParticipantJanitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
