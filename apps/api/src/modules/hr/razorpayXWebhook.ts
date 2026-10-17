import { Router, Request, Response } from 'express';
import express from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { razorpayXService, type RazorpayXPayout } from '../../services/razorpayX.service';
import { razorpayXPayoutService } from './razorpayXPayout.service';

const router: ReturnType<typeof Router> = Router();

/**
 * RazorpayX webhook — mounted at POST /api/webhooks/razorpay-x/:branchId.
 *
 * Each school registers its own webhook URL in their X Dashboard with the
 * branch id as the last segment. We use that to look up the per-branch
 * webhook secret and verify the HMAC signature.
 *
 * Raw body is required for HMAC verification, so this router must be
 * mounted BEFORE the global express.json() middleware.
 */
router.post(
  '/webhooks/razorpay-x/:branchId',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req: Request, res: Response) => {
    const branchId = req.params.branchId as string;
    if (!branchId || !ObjectId.isValid(branchId)) {
      res.status(400).json({ ok: false, error: 'invalid_branch' });
      return;
    }
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body ?? '');

    // Locate the branch's stored settings so we can decrypt the webhook
    // secret. We resolve tenant via the settings row itself — a single
    // branchId is globally unique because it's a Mongo ObjectId.
    const settingsDoc = await collections.hrSettings.findOne({
      branchId: new ObjectId(branchId),
    });
    if (!settingsDoc) {
      logger.warn({ branchId }, 'RazorpayX webhook: no hrSettings for branch');
      res.status(404).json({ ok: false, error: 'unknown_branch' });
      return;
    }
    const tenantId = (settingsDoc.tenantId as ObjectId).toString();
    const raw = await razorpayXPayoutService.getRawSettings(tenantId, branchId);
    if (!raw) {
      logger.warn({ branchId }, 'RazorpayX webhook: X not configured for branch');
      res.status(412).json({ ok: false, error: 'not_configured' });
      return;
    }
    if (!razorpayXService.verifyWebhookSignature(rawBody, signature, raw.webhookSecret)) {
      logger.warn({ branchId }, 'RazorpayX webhook: signature invalid');
      res.status(400).json({ ok: false, error: 'invalid_signature' });
      return;
    }

    let event: {
      event?: string;
      id?: string;
      created_at?: number;
      payload?: Record<string, { entity?: Record<string, unknown> }>;
    };
    try {
      event = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ ok: false, error: 'invalid_json' });
      return;
    }

    const eventId = event.id || `${event.event}-${event.created_at}`;
    const eventType = event.event || 'unknown';

    // Idempotency — same pattern as the fees webhook. Duplicate deliveries
    // race on the unique {source, eventId} index.
    if (eventId) {
      try {
        await collections.webhookEvents.insertOne({
          _id: new ObjectId(),
          source: 'razorpay_x',
          eventId,
          eventType,
          branchId: new ObjectId(branchId),
          receivedAt: new Date(),
        });
      } catch (err) {
        if ((err as { code?: number })?.code === 11000) {
          logger.info({ eventId, eventType }, 'RazorpayX webhook duplicate, skipping');
          res.json({ ok: true, deduped: true });
          return;
        }
      }
    }

    try {
      await dispatch(tenantId, branchId, eventType, event);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err, eventType, eventId }, 'RazorpayX webhook handler failed');
      res.status(500).json({ ok: false });
    }
  }
);

async function dispatch(
  tenantId: string,
  branchId: string,
  eventType: string,
  event: { payload?: Record<string, { entity?: Record<string, unknown> }> }
): Promise<void> {
  const payload = event.payload ?? {};

  if (eventType.startsWith('payout.')) {
    const payout = payload.payout?.entity as unknown as RazorpayXPayout | undefined;
    if (!payout?.id) return;
    await razorpayXPayoutService.applyPayoutUpdate(payout);
    logger.info(
      { payoutId: payout.id, status: payout.status, event: eventType },
      'RazorpayX — payout update'
    );
    return;
  }

  if (eventType === 'fund_account.validation.completed') {
    const validation = payload.fund_account_validation?.entity as
      | {
          fund_account?: { id?: string };
          results?: { account_status?: 'active' | 'invalid'; registered_name?: string };
          error?: { description?: string };
        }
      | undefined;
    const fundAccountId = validation?.fund_account?.id;
    if (!fundAccountId) return;
    const isActive = validation?.results?.account_status === 'active';
    await collections.staff.updateOne(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        'bankDetails.razorpayX.fundAccountId': fundAccountId,
      },
      {
        $set: {
          'bankDetails.razorpayX.validationStatus': isActive ? 'active' : 'failed',
          'bankDetails.razorpayX.validationFailureReason': isActive
            ? undefined
            : (validation?.error?.description ?? 'Bank rejected the penny drop.'),
          'bankDetails.razorpayX.lastSyncedAt': new Date(),
          updatedAt: new Date(),
        },
      }
    );
    logger.info({ fundAccountId, isActive }, 'RazorpayX — fund account validation applied');
    return;
  }

  logger.debug({ event: eventType }, 'RazorpayX webhook event ignored');
}

export default router;
