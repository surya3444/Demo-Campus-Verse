import { Router, Request, Response } from 'express';
import express from 'express';
import { ObjectId } from 'mongodb';
import { WebhookReceiver } from 'livekit-server-sdk';
import { collections } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

const router: ReturnType<typeof Router> = Router();

// Webhook payloads need the *raw* body for signature verification.
// We can't use the global express.json() middleware here.
router.post(
  '/webhooks/livekit',
  express.raw({ type: '*/*', limit: '5mb' }),
  async (req: Request, res: Response) => {
    if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      res.status(500).json({ error: 'LiveKit not configured' });
      return;
    }

    try {
      const receiver = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
      const authHeader = req.headers.authorization || '';
      const bodyStr =
        req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body ?? '');
      const event = await receiver.receive(bodyStr, authHeader);

      logger.info(
        { id: event.id, event: event.event, room: event.room?.name },
        'LiveKit webhook received'
      );

      // Idempotency: short-circuit duplicate deliveries by event id.
      // The unique index on `eventId` means concurrent duplicate deliveries
      // race on insert; the loser catches and returns ok.
      if (event.id) {
        try {
          await collections.webhookEvents.insertOne({
            _id: new ObjectId(),
            source: 'livekit',
            eventId: event.id,
            eventType: event.event,
            receivedAt: new Date(),
          });
        } catch (err) {
          // E11000 duplicate key — already processed.
          if ((err as { code?: number })?.code === 11000) {
            logger.info({ id: event.id }, 'LiveKit webhook duplicate, skipping');
            res.json({ ok: true, deduped: true });
            return;
          }
          throw err;
        }
      }

      const roomName = event.room?.name;
      if (!roomName?.startsWith('lc_')) {
        res.json({ ok: true, ignored: true });
        return;
      }
      const liveClassId = roomName.slice(3);
      if (!ObjectId.isValid(liveClassId)) {
        res.json({ ok: true, ignored: true });
        return;
      }
      const _id = new ObjectId(liveClassId);

      switch (event.event) {
        case 'room_started':
          // Only flip from `scheduled` so a manual start() (which already set
          // the doc to `live`) isn't overwritten with a later actualStart.
          await collections.liveClasses.updateOne(
            { _id, status: 'scheduled' },
            { $set: { status: 'live', actualStart: new Date(), updatedAt: new Date() } }
          );
          break;

        case 'room_finished':
          // Only set actualEnd once. The status guard avoids re-firing the
          // poll-close cascade on duplicate `room_finished` deliveries.
          await collections.liveClasses.updateOne(
            { _id, status: { $nin: ['ended', 'cancelled'] } },
            { $set: { status: 'ended', actualEnd: new Date(), updatedAt: new Date() } }
          );
          await collections.liveClassPolls.updateMany(
            { liveClassId: _id, status: 'live' },
            { $set: { status: 'closed', closedAt: new Date() } }
          );
          break;

        case 'egress_ended': {
          // LiveKit signals success and failure both via `egress_ended`. The
          // egressInfo.status enum tells us which: EGRESS_COMPLETE=3 succeeded,
          // EGRESS_FAILED=4 / EGRESS_ABORTED=5 / EGRESS_LIMIT_REACHED=6 did not.
          const egress = event.egressInfo;
          const status = egress?.status;
          const SUCCESS = 3;

          if (egress && status === SUCCESS) {
            const fileResults = egress.fileResults ?? [];
            const streamResults = egress.streamResults ?? [];
            const url = fileResults[0]?.location || streamResults[0]?.url || undefined;
            if (url) {
              await collections.liveClasses.updateOne(
                { _id, recordingStatus: { $ne: 'ready' } },
                {
                  $set: {
                    recordingUrl: url,
                    recordingStatus: 'ready',
                    updatedAt: new Date(),
                  },
                }
              );
            }
          } else {
            // Failure / abort / limit-reached — surface it instead of leaving
            // the class stuck on `pending` forever.
            await collections.liveClasses.updateOne(
              { _id, recordingStatus: { $nin: ['ready', 'failed'] } },
              {
                $set: {
                  recordingStatus: 'failed',
                  updatedAt: new Date(),
                },
              }
            );
            logger.warn(
              { liveClassId, egressStatus: status },
              'LiveKit egress ended without success'
            );
          }
          break;
        }

        default:
          // ignore other events
          break;
      }

      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, 'LiveKit webhook processing failed');
      res.status(400).json({ error: 'Invalid webhook' });
    }
  }
);

export default router;
