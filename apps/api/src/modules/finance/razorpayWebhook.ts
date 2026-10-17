import { Router, Request, Response } from 'express';
import express from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { razorpayService } from '../../services/razorpay.service';
import { razorpayRouteService } from './razorpayRoute.service';

const router: ReturnType<typeof Router> = Router();

// Razorpay webhook bodies must be verified against the raw request payload.
// We mount this router BEFORE the global express.json() so the body remains a
// Buffer here. Mirror of the existing LiveKit webhook plumbing in
// modules/teaching/liveClass.webhook.ts.
router.post(
  '/webhooks/razorpay',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req: Request, res: Response) => {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body ?? '');

    if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
      logger.warn(
        { signature: signature.slice(0, 8) + '...' },
        'Razorpay webhook signature invalid'
      );
      res.status(400).json({ ok: false, error: 'invalid_signature' });
      return;
    }

    let event: {
      event?: string;
      payload?: Record<string, { entity?: Record<string, unknown> }>;
      id?: string;
      created_at?: number;
    };
    try {
      event = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ ok: false, error: 'invalid_json' });
      return;
    }

    const eventId = event.id || `${event.event}-${event.created_at}`;
    const eventType = event.event || 'unknown';

    // Idempotency — drop duplicates by Razorpay event id. Same pattern as the
    // LiveKit webhook. The unique index on eventId enforces it at the DB level.
    if (eventId) {
      try {
        await collections.webhookEvents.insertOne({
          _id: new ObjectId(),
          source: 'razorpay',
          eventId,
          eventType,
          receivedAt: new Date(),
        });
      } catch (err) {
        if ((err as { code?: number })?.code === 11000) {
          logger.info({ eventId, eventType }, 'Razorpay webhook duplicate, skipping');
          res.json({ ok: true, deduped: true });
          return;
        }
        // If the collection lacks the unique index it'll just be a no-op insert.
      }
    }

    try {
      await dispatch(eventType, event);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err, eventType, eventId }, 'Razorpay webhook handler failed');
      // Razorpay retries on non-2xx — for unexpected handler errors we want
      // a retry, so return 500. Validation failures already returned earlier.
      res.status(500).json({ ok: false });
    }
  }
);

async function dispatch(
  eventType: string,
  event: { payload?: Record<string, { entity?: Record<string, unknown> }> }
): Promise<void> {
  const payload = event.payload ?? {};
  switch (eventType) {
    // ----- Linked account lifecycle -----
    case 'account.under_review':
    case 'account.needs_clarification':
    case 'account.activated':
    case 'account.suspended':
    case 'account.rejected': {
      const account = payload.account?.entity as { id?: string; status?: string } | undefined;
      if (account?.id) {
        const explicitStatus = eventType.replace('account.', '');
        await razorpayRouteService.syncFromWebhook(
          account.id,
          account.status || explicitStatus,
          account
        );
      }
      return;
    }

    // ----- Transfer settlement events -----
    case 'transfer.processed':
    case 'transfer.failed': {
      const transfer = payload.transfer?.entity as
        | { id?: string; recipient?: string; notes?: Record<string, string>; amount?: number }
        | undefined;
      if (!transfer) return;
      const transactionId = transfer.notes?.transactionId;
      if (!transactionId || !ObjectId.isValid(transactionId)) return;
      await collections.feeTransactions.updateOne(
        { _id: new ObjectId(transactionId) },
        {
          $set: {
            'onlinePayment.transferId': transfer.id,
            'onlinePayment.transferStatus':
              eventType === 'transfer.processed' ? 'processed' : 'failed',
            updatedAt: new Date(),
          },
        }
      );
      logger.info(
        {
          transactionId,
          transferId: transfer.id,
          status: eventType === 'transfer.processed' ? 'processed' : 'failed',
        },
        'Razorpay Route — transfer status updated'
      );
      return;
    }

    // ----- Idempotency safety net for the synchronous verify flow -----
    case 'payment.captured':
    case 'payment.failed':
    case 'order.paid':
      // These are already handled by verifyOnlinePayment client-side; this is
      // only logged so we can spot orders that were paid but never verified
      // (e.g. user closed the browser before the callback ran). Out of scope
      // for v1 to auto-reconcile.
      logger.info({ event: eventType }, 'Razorpay payment event received');
      return;

    case 'refund.processed':
    case 'refund.failed':
      logger.info({ event: eventType }, 'Razorpay refund event received (no-op in v1)');
      return;

    default:
      logger.debug({ event: eventType }, 'Razorpay webhook event ignored');
  }
}

export default router;
