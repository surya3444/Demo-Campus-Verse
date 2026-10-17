import { Server as IOServer, Socket } from 'socket.io';
import { ObjectId } from 'mongodb';
import * as Y from 'yjs';
import { collections } from '../config/database';
import { logger } from '../lib/logger';
import type { SocketData } from './socket';
import { requireSocketPermission, socketHasPermission } from './socketRbac';

const ROOM = (tenantId: string, liveClassId: string) => `live:${tenantId}:${liveClassId}`;

// Whiteboard Y.Doc state per class (in-memory). Hydrated lazily from the
// most recent persisted snapshot. Persisted every 30s and on class end.
interface WhiteboardState {
  doc: Y.Doc;
  saveTimer?: NodeJS.Timeout;
  dirty: boolean;
  hydrated: boolean;
}
const whiteboards = new Map<string, WhiteboardState>();

async function getOrLoadWhiteboard(liveClassId: string): Promise<WhiteboardState> {
  const existing = whiteboards.get(liveClassId);
  if (existing) return existing;

  const doc = new Y.Doc();
  const state: WhiteboardState = { doc, dirty: false, hydrated: false };
  whiteboards.set(liveClassId, state);

  // Hydrate from latest snapshot
  try {
    const snap = await collections.liveClassWhiteboardSnapshots.findOne(
      { liveClassId: new ObjectId(liveClassId) },
      { sort: { version: -1 } }
    );
    if (snap?.ydocBinary) {
      const buf = snap.ydocBinary as Buffer;
      Y.applyUpdate(doc, new Uint8Array(buf));
    }
  } catch (e) {
    logger.warn({ err: e, liveClassId }, 'whiteboard hydrate failed');
  }
  state.hydrated = true;
  return state;
}

async function persistWhiteboard(liveClassId: string, isFinal = false) {
  const state = whiteboards.get(liveClassId);
  if (!state || !state.dirty) return;
  try {
    const update = Y.encodeStateAsUpdate(state.doc);
    const lcOid = new ObjectId(liveClassId);
    const lc = await collections.liveClasses.findOne({ _id: lcOid });
    if (!lc) return;

    // Increment version
    const last = await collections.liveClassWhiteboardSnapshots.findOne(
      { liveClassId: lcOid },
      { sort: { version: -1 }, projection: { version: 1 } }
    );
    const version = ((last?.version as number | undefined) ?? 0) + 1;

    await collections.liveClassWhiteboardSnapshots.insertOne({
      _id: new ObjectId(),
      tenantId: lc.tenantId as ObjectId,
      liveClassId: lcOid,
      version,
      ydocBinary: Buffer.from(update),
      createdAt: new Date(),
      isFinal,
    });

    // Trim to last 10 (keep finals)
    const all = await collections.liveClassWhiteboardSnapshots
      .find({ liveClassId: lcOid, isFinal: { $ne: true } })
      .sort({ version: -1 })
      .skip(10)
      .toArray();
    if (all.length > 0) {
      await collections.liveClassWhiteboardSnapshots.deleteMany({
        _id: { $in: all.map((d) => d._id) },
      });
    }

    state.dirty = false;
    logger.debug({ liveClassId, version, bytes: update.length }, 'whiteboard snapshot saved');
  } catch (e) {
    logger.error({ err: e, liveClassId }, 'whiteboard persist failed');
  }
}

function scheduleWhiteboardSave(liveClassId: string) {
  const state = whiteboards.get(liveClassId);
  if (!state) return;
  if (state.saveTimer) return;
  state.saveTimer = setTimeout(async () => {
    state.saveTimer = undefined;
    await persistWhiteboard(liveClassId, false);
  }, 30_000);
}

/**
 * Final-snapshot the whiteboard at class-end and free its in-memory Y.Doc.
 * Called by the live class service when end() runs.
 */
export async function finalizeWhiteboard(liveClassId: string): Promise<void> {
  const state = whiteboards.get(liveClassId);
  if (!state) return;
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = undefined;
  }
  state.dirty = true; // ensure persist runs even if no recent changes
  await persistWhiteboard(liveClassId, true);
  state.doc.destroy();
  whiteboards.delete(liveClassId);
}

/**
 * Per-socket state. We only ever join one live class per socket at a time;
 * if the user opens two tabs they get two sockets.
 */
interface SocketState {
  liveClassId?: string;
  role?: 'host' | 'cohost' | 'student';
  staffId?: string;
  studentId?: string;
  displayName?: string;
  lastChatAt?: number[];
  lastReactionAt?: number;
  heartbeatTimer?: NodeJS.Timeout;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

const stateOf = (socket: Socket): SocketState => {
  const s = socket.data as SocketData & { _live?: SocketState };
  if (!s._live) s._live = {};
  return s._live;
};

const data = (socket: Socket) => socket.data as SocketData;

async function resolveDisplayName(socket: Socket): Promise<string> {
  const d = data(socket);
  const user = await collections.users.findOne(
    { _id: new ObjectId(d.userId) },
    { projection: { firstName: 1, lastName: 1, email: 1 } }
  );
  if (user) {
    const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return full || (user.email as string) || d.email;
  }
  return d.email;
}

async function assertLiveClassAccess(
  liveClassId: string,
  socket: Socket
): Promise<{ role: 'host' | 'cohost' | 'student'; staffId?: string; studentId?: string }> {
  const d = data(socket);
  const tenantOid = new ObjectId(d.tenantId);
  const liveClass = await collections.liveClasses.findOne({
    _id: new ObjectId(liveClassId),
    tenantId: tenantOid,
  });
  if (!liveClass) throw new Error('LIVE_CLASS_NOT_FOUND');
  if (liveClass.status === 'cancelled' || liveClass.status === 'ended')
    throw new Error('LIVE_CLASS_NOT_ACTIVE');

  // Host check
  const hostStaffId = (liveClass.hostStaffId as ObjectId | undefined)?.toString();
  const cohostIds =
    (liveClass.coHostStaffIds as ObjectId[] | undefined)?.map((x) => x.toString()) ?? [];

  // Find staff record for this user (if any)
  const staff = await collections.staff.findOne({
    tenantId: tenantOid,
    userId: new ObjectId(d.userId),
    status: 'active',
  });
  const staffIdStr = staff?._id?.toString();

  if (staffIdStr && hostStaffId === staffIdStr) {
    return { role: 'host', staffId: staffIdStr };
  }
  if (staffIdStr && cohostIds.includes(staffIdStr)) {
    return { role: 'cohost', staffId: staffIdStr };
  }

  // Admin bypass
  if ((d.roleLevel ?? 99) <= 3) {
    return { role: 'cohost', staffId: staffIdStr };
  }

  // Student enrollment check
  const student = await collections.students.findOne({
    tenantId: tenantOid,
    userId: new ObjectId(d.userId),
    sectionId: liveClass.sectionId,
    status: 'active',
  });
  if (student) {
    return { role: 'student', studentId: student._id.toString() };
  }

  throw new Error('LIVE_CLASS_FORBIDDEN');
}

export function registerLiveClassHandlers(io: IOServer, socket: Socket): void {
  socket.on('class:join', async (payload: { liveClassId: string }, ack?: (r: unknown) => void) => {
    try {
      const { liveClassId } = payload || {};
      if (!liveClassId) throw new Error('liveClassId required');

      requireSocketPermission(socket, 'teaching.liveClasses', 'view');
      const access = await assertLiveClassAccess(liveClassId, socket);
      const displayName = await resolveDisplayName(socket);

      const st = stateOf(socket);
      st.liveClassId = liveClassId;
      st.role = access.role;
      st.staffId = access.staffId;
      st.studentId = access.studentId;
      st.displayName = displayName;

      socket.join(ROOM(data(socket).tenantId, liveClassId));

      // Persist participant join (upsert)
      const tenantOid = new ObjectId(data(socket).tenantId);
      const userOid = new ObjectId(data(socket).userId);
      await collections.liveClassParticipants.updateOne(
        { liveClassId: new ObjectId(liveClassId), userId: userOid },
        {
          $set: {
            tenantId: tenantOid,
            liveClassId: new ObjectId(liveClassId),
            userId: userOid,
            role: access.role,
            staffId: access.staffId ? new ObjectId(access.staffId) : undefined,
            studentId: access.studentId ? new ObjectId(access.studentId) : undefined,
            displayName,
            lastSeenAt: new Date(),
          },
          $setOnInsert: { joinedAt: new Date() },
        },
        { upsert: true }
      );

      // Server-driven heartbeat: refresh lastSeenAt every 30s so the janitor
      // can tell live sockets apart from ones that crashed without firing the
      // disconnect handler. Cleared on class:leave or disconnect below.
      if (st.heartbeatTimer) clearInterval(st.heartbeatTimer);
      st.heartbeatTimer = setInterval(() => {
        const id = st.liveClassId;
        if (!id) return;
        collections.liveClassParticipants
          .updateOne(
            { liveClassId: new ObjectId(id), userId: userOid },
            { $set: { lastSeenAt: new Date() } }
          )
          .catch((err) => {
            logger.warn({ err, liveClassId: id }, 'participant heartbeat update failed');
          });
      }, HEARTBEAT_INTERVAL_MS);
      st.heartbeatTimer.unref?.();

      // Broadcast presence — `socket.to(...)` excludes the sender so the
      // joiner doesn't end up in their own `socket.participants` map.
      socket.to(ROOM(data(socket).tenantId, liveClassId)).emit('presence:joined', {
        userId: data(socket).userId,
        displayName,
        role: access.role,
      });

      // Send current poll if any
      const livePoll = await collections.liveClassPolls.findOne({
        liveClassId: new ObjectId(liveClassId),
        status: 'live',
      });
      if (livePoll) {
        socket.emit('poll:current', {
          pollId: livePoll._id.toString(),
          question: livePoll.question,
          options: (livePoll.options as { text: string }[]).map((o) => ({ text: o.text })),
          type: livePoll.type,
          launchedAt: livePoll.launchedAt,
          closesAt: livePoll.closesAt,
        });
      }

      // Send recent chat history (last 50)
      const recentMessages = await collections.liveClassMessages
        .find({ liveClassId: new ObjectId(liveClassId), deletedAt: { $exists: false } })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      ack?.({
        ok: true,
        role: access.role,
        recentMessages: recentMessages.reverse().map((m) => ({
          _id: m._id.toString(),
          senderUserId: (m.senderUserId as ObjectId).toString(),
          senderName: m.senderName,
          senderRole: m.senderRole,
          text: m.text,
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'JOIN_FAILED';
      logger.warn({ err: msg }, 'class:join failed');
      ack?.({ ok: false, error: msg });
    }
  });

  socket.on('class:leave', async () => {
    const st = stateOf(socket);
    if (!st.liveClassId) return;
    const liveClassId = st.liveClassId;
    const room = ROOM(data(socket).tenantId, liveClassId);
    socket.leave(room);

    if (st.heartbeatTimer) {
      clearInterval(st.heartbeatTimer);
      st.heartbeatTimer = undefined;
    }

    await collections.liveClassParticipants.updateOne(
      { liveClassId: new ObjectId(liveClassId), userId: new ObjectId(data(socket).userId) },
      { $set: { leftAt: new Date(), lastSeenAt: new Date() } }
    );

    socket.to(room).emit('presence:left', { userId: data(socket).userId });
    st.liveClassId = undefined;
  });

  socket.on('chat:send', async (payload: { text: string }, ack?: (r: unknown) => void) => {
    try {
      const st = stateOf(socket);
      if (!st.liveClassId) throw new Error('NOT_IN_CLASS');
      requireSocketPermission(socket, 'teaching.liveClasses', 'view');
      const text = (payload?.text ?? '').trim();
      if (!text) throw new Error('EMPTY');
      if (text.length > 2000) throw new Error('TOO_LONG');

      // Rate limit: 5 messages per 10 seconds
      const now = Date.now();
      st.lastChatAt = (st.lastChatAt ?? []).filter((t) => now - t < 10_000);
      if (st.lastChatAt.length >= 5) throw new Error('RATE_LIMITED');
      st.lastChatAt.push(now);

      const msg = {
        _id: new ObjectId(),
        tenantId: new ObjectId(data(socket).tenantId),
        liveClassId: new ObjectId(st.liveClassId),
        senderUserId: new ObjectId(data(socket).userId),
        senderName: st.displayName ?? data(socket).email,
        senderRole: st.role ?? 'student',
        text,
        createdAt: new Date(),
      };
      await collections.liveClassMessages.insertOne(msg);

      io.to(ROOM(data(socket).tenantId, st.liveClassId)).emit('chat:new', {
        _id: msg._id.toString(),
        senderUserId: msg.senderUserId.toString(),
        senderName: msg.senderName,
        senderRole: msg.senderRole,
        text: msg.text,
        createdAt: msg.createdAt,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err instanceof Error ? err.message : 'CHAT_FAILED' });
    }
  });

  socket.on('chat:delete', async (payload: { messageId: string }, ack?: (r: unknown) => void) => {
    try {
      const st = stateOf(socket);
      if (!st.liveClassId) throw new Error('NOT_IN_CLASS');
      const { messageId } = payload || {};
      if (!messageId) throw new Error('INVALID');

      const msg = await collections.liveClassMessages.findOne({ _id: new ObjectId(messageId) });
      if (!msg) throw new Error('NOT_FOUND');
      if (msg.liveClassId.toString() !== st.liveClassId) throw new Error('FORBIDDEN');

      const isHostLike = st.role === 'host' || st.role === 'cohost';
      const isAuthor = (msg.senderUserId as ObjectId).toString() === data(socket).userId;
      if (!isHostLike && !isAuthor) throw new Error('FORBIDDEN');
      if (isHostLike && !isAuthor) {
        requireSocketPermission(socket, 'teaching.liveClasses', 'edit');
      }

      await collections.liveClassMessages.updateOne(
        { _id: msg._id },
        { $set: { deletedAt: new Date(), deletedByUserId: new ObjectId(data(socket).userId) } }
      );

      io.to(ROOM(data(socket).tenantId, st.liveClassId)).emit('chat:deleted', {
        _id: msg._id.toString(),
        deletedByUserId: data(socket).userId,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err instanceof Error ? err.message : 'CHAT_DELETE_FAILED' });
    }
  });

  socket.on('reaction:send', (payload: { emoji: string }) => {
    const st = stateOf(socket);
    if (!st.liveClassId) return;
    // Throttle 1 / 500ms
    const now = Date.now();
    if (st.lastReactionAt && now - st.lastReactionAt < 500) return;
    st.lastReactionAt = now;
    const emoji = (payload?.emoji ?? '').slice(0, 8);
    if (!emoji) return;
    io.to(ROOM(data(socket).tenantId, st.liveClassId)).emit('reaction:burst', {
      emoji,
      userId: data(socket).userId,
      displayName: st.displayName,
      at: now,
    });
  });

  socket.on('hand:raise', async () => {
    const st = stateOf(socket);
    if (!st.liveClassId || st.role !== 'student') return;
    io.to(ROOM(data(socket).tenantId, st.liveClassId)).emit('hand:state', {
      userId: data(socket).userId,
      displayName: st.displayName,
      raised: true,
      at: Date.now(),
    });
  });

  socket.on('hand:lower', () => {
    const st = stateOf(socket);
    if (!st.liveClassId) return;
    io.to(ROOM(data(socket).tenantId, st.liveClassId)).emit('hand:state', {
      userId: data(socket).userId,
      displayName: st.displayName,
      raised: false,
      at: Date.now(),
    });
  });

  // ============ Polls ============
  socket.on(
    'poll:launch',
    async (
      payload: {
        question: string;
        options: { text: string; isCorrect?: boolean }[];
        type?: 'single' | 'multi';
        durationSec?: number;
      },
      ack?: (r: unknown) => void
    ) => {
      try {
        const st = stateOf(socket);
        if (!st.liveClassId) throw new Error('NOT_IN_CLASS');
        if (st.role !== 'host' && st.role !== 'cohost') throw new Error('FORBIDDEN');
        requireSocketPermission(socket, 'teaching.liveClasses', 'edit');

        const question = (payload?.question ?? '').trim();
        const options = (payload?.options ?? []).filter((o) => o?.text?.trim());
        if (!question || options.length < 2) throw new Error('INVALID_POLL');

        const durationSec = Math.max(5, Math.min(600, payload.durationSec ?? 30));
        const launchedAt = new Date();
        const closesAt = new Date(launchedAt.getTime() + durationSec * 1000);

        // Auto-close any existing live polls
        await collections.liveClassPolls.updateMany(
          { liveClassId: new ObjectId(st.liveClassId), status: 'live' },
          { $set: { status: 'closed', closedAt: new Date() } }
        );

        const poll = {
          _id: new ObjectId(),
          tenantId: new ObjectId(data(socket).tenantId),
          liveClassId: new ObjectId(st.liveClassId),
          createdByUserId: new ObjectId(data(socket).userId),
          question,
          options: options.map((o) => ({ text: o.text.trim(), isCorrect: !!o.isCorrect })),
          type: payload.type ?? 'single',
          durationSec,
          launchedAt,
          closesAt,
          status: 'live' as const,
        };
        await collections.liveClassPolls.insertOne(poll);

        io.to(ROOM(data(socket).tenantId, st.liveClassId)).emit('poll:current', {
          pollId: poll._id.toString(),
          question: poll.question,
          options: poll.options.map((o) => ({ text: o.text })),
          type: poll.type,
          launchedAt: poll.launchedAt,
          closesAt: poll.closesAt,
        });

        // Schedule auto-close
        const tenantIdForTimeout = data(socket).tenantId;
        setTimeout(
          async () => {
            try {
              await closePoll(io, poll._id.toString(), tenantIdForTimeout, st.liveClassId!);
            } catch (e) {
              logger.error({ e }, 'auto poll close failed');
            }
          },
          durationSec * 1000 + 200
        );

        ack?.({ ok: true, pollId: poll._id.toString() });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'POLL_LAUNCH_FAILED' });
      }
    }
  );

  socket.on(
    'poll:respond',
    async (payload: { pollId: string; selectedIndices: number[] }, ack?: (r: unknown) => void) => {
      try {
        const st = stateOf(socket);
        if (!st.liveClassId) throw new Error('NOT_IN_CLASS');
        const { pollId, selectedIndices } = payload || {};
        if (!pollId || !Array.isArray(selectedIndices)) throw new Error('INVALID');

        const poll = await collections.liveClassPolls.findOne({ _id: new ObjectId(pollId) });
        if (!poll || poll.status !== 'live') throw new Error('POLL_CLOSED');
        if (new Date() > new Date(poll.closesAt as Date)) throw new Error('POLL_EXPIRED');

        const opts = poll.options as { text: string; isCorrect?: boolean }[];
        const validIndices = selectedIndices.filter((i) => i >= 0 && i < opts.length);
        if (validIndices.length === 0) throw new Error('NO_OPTIONS');

        const isCorrect =
          poll.type === 'single'
            ? !!opts[validIndices[0]]?.isCorrect
            : validIndices.every((i) => opts[i]?.isCorrect) &&
              opts.filter((o) => o.isCorrect).length === validIndices.length;

        await collections.liveClassPollResponses.updateOne(
          { pollId: new ObjectId(pollId), userId: new ObjectId(data(socket).userId) },
          {
            $set: {
              tenantId: new ObjectId(data(socket).tenantId),
              liveClassId: new ObjectId(st.liveClassId),
              pollId: new ObjectId(pollId),
              userId: new ObjectId(data(socket).userId),
              studentId: st.studentId ? new ObjectId(st.studentId) : undefined,
              selectedIndices: validIndices,
              isCorrect,
              respondedAt: new Date(),
            },
          },
          { upsert: true }
        );

        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'POLL_RESPOND_FAILED' });
      }
    }
  );

  socket.on('poll:close', async (payload: { pollId: string }, ack?: (r: unknown) => void) => {
    try {
      const st = stateOf(socket);
      if (!st.liveClassId) throw new Error('NOT_IN_CLASS');
      if (st.role !== 'host' && st.role !== 'cohost') throw new Error('FORBIDDEN');
      requireSocketPermission(socket, 'teaching.liveClasses', 'edit');
      await closePoll(io, payload.pollId, data(socket).tenantId, st.liveClassId);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err instanceof Error ? err.message : 'POLL_CLOSE_FAILED' });
    }
  });

  // ============ Whiteboard ============
  socket.on('whiteboard:snapshot:request', async (_: unknown, ack?: (r: unknown) => void) => {
    try {
      const st = stateOf(socket);
      if (!st.liveClassId) throw new Error('NOT_IN_CLASS');
      const wb = await getOrLoadWhiteboard(st.liveClassId);
      const update = Y.encodeStateAsUpdate(wb.doc);
      ack?.({ ok: true, update: Buffer.from(update).toString('base64') });
    } catch (err) {
      ack?.({
        ok: false,
        error: err instanceof Error ? err.message : 'WHITEBOARD_SNAPSHOT_FAILED',
      });
    }
  });

  socket.on('whiteboard:op', async (payload: { update: string }) => {
    const st = stateOf(socket);
    if (!st.liveClassId) return;
    if (!socketHasPermission(socket, 'teaching.liveClasses', 'view')) return;

    // Only host/cohost can draw by default; students can if studentCanDraw enabled
    if (st.role === 'student') {
      try {
        const lc = await collections.liveClasses.findOne({
          _id: new ObjectId(st.liveClassId),
        });
        if (!lc?.settings?.studentCanDraw) return;
      } catch {
        return;
      }
    }

    if (!payload?.update || typeof payload.update !== 'string') return;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(Buffer.from(payload.update, 'base64'));
    } catch {
      return;
    }
    if (bytes.length === 0 || bytes.length > 1024 * 256) return; // 256KB cap per op

    const wb = await getOrLoadWhiteboard(st.liveClassId);
    try {
      Y.applyUpdate(wb.doc, bytes);
    } catch (e) {
      logger.warn({ err: e }, 'whiteboard apply update failed');
      return;
    }
    wb.dirty = true;
    scheduleWhiteboardSave(st.liveClassId);

    // Fan out to other peers in the room (skip sender)
    socket
      .to(ROOM(data(socket).tenantId, st.liveClassId))
      .emit('whiteboard:op', { update: payload.update });
  });

  socket.on('disconnect', async () => {
    const st = stateOf(socket);
    if (st.heartbeatTimer) {
      clearInterval(st.heartbeatTimer);
      st.heartbeatTimer = undefined;
    }
    if (st.liveClassId) {
      try {
        await collections.liveClassParticipants.updateOne(
          { liveClassId: new ObjectId(st.liveClassId), userId: new ObjectId(data(socket).userId) },
          { $set: { leftAt: new Date(), lastSeenAt: new Date() } }
        );
      } catch (err) {
        logger.error(
          { err, liveClassId: st.liveClassId, userId: data(socket).userId },
          'failed to mark participant leftAt on disconnect (janitor will reconcile)'
        );
      }
      socket
        .to(ROOM(data(socket).tenantId, st.liveClassId))
        .emit('presence:left', { userId: data(socket).userId });
    }
  });
}

async function closePoll(io: IOServer, pollId: string, tenantId: string, liveClassId: string) {
  const pollOid = new ObjectId(pollId);
  const poll = await collections.liveClassPolls.findOne({ _id: pollOid });
  if (!poll) return;
  if (poll.status === 'closed' || poll.status === 'revealed') return;

  await collections.liveClassPolls.updateOne(
    { _id: pollOid },
    { $set: { status: 'closed', closedAt: new Date() } }
  );

  // Aggregate responses
  const responses = await collections.liveClassPollResponses.find({ pollId: pollOid }).toArray();

  const opts = poll.options as { text: string; isCorrect?: boolean }[];
  const counts = opts.map(() => 0);
  for (const r of responses) {
    for (const idx of (r.selectedIndices as number[]) ?? []) {
      if (counts[idx] !== undefined) counts[idx]++;
    }
  }

  io.to(ROOM(tenantId, liveClassId)).emit('poll:close', {
    pollId,
    results: opts.map((o, i) => ({
      text: o.text,
      isCorrect: !!o.isCorrect,
      count: counts[i],
    })),
    totalResponses: responses.length,
  });
}
