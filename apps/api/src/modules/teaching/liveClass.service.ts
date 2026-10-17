import { ObjectId, Filter, Document, WithId } from 'mongodb';
import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  EncodedFileType,
  type EncodedFileOutput,
  type RoomCompositeOptions,
} from 'livekit-server-sdk';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { getStaffIdForUser } from './teaching.utils';
import { finalizeWhiteboard } from '../../realtime/liveClass.handlers';
import { getIO } from '../../realtime/socket';
import type { LiveClass, LiveClassRole, LiveClassJoinResponse } from '@campus-verse/shared';

interface LiveClassDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  title: string;
  description?: string;
  classId?: ObjectId | null;
  sectionId: ObjectId;
  subjectId?: ObjectId | null;
  hostStaffId: ObjectId;
  hostName?: string;
  coHostStaffIds?: ObjectId[];
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  provider: 'livekit';
  providerRoomName: string;
  recordingUrl?: string;
  recordingStatus?: 'pending' | 'ready' | 'failed';
  recordingEnabled?: boolean;
  recordingEgressId?: string;
  autoMarkAttendance?: boolean;
  attendanceThresholdPct?: number;
  attendanceMarkedAt?: Date;
  settings?: {
    chatEnabled?: boolean;
    studentCanUnmute?: boolean;
    studentCanDraw?: boolean;
    recordingEnabled?: boolean;
  };
  className?: string;
  sectionName?: string;
  subjectName?: string;
  /** True when an admin scheduled this class for a different teacher. */
  lockedForHost?: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateInput {
  title: string;
  description?: string;
  classId?: string;
  sectionId: string;
  subjectId?: string;
  /**
   * Teacher who will host the class. Only honoured when the caller is an
   * admin scheduling on behalf of someone else; non-admins always host their
   * own classes regardless of what they send.
   */
  hostStaffId?: string;
  coHostStaffIds?: string[];
  scheduledStart: Date;
  scheduledEnd: Date;
  recordingEnabled?: boolean;
  autoMarkAttendance?: boolean;
  attendanceThresholdPct?: number;
  settings?: LiveClass['settings'];
}

interface UpdateInput {
  title?: string;
  description?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  coHostStaffIds?: string[];
  recordingEnabled?: boolean;
  autoMarkAttendance?: boolean;
  attendanceThresholdPct?: number;
  settings?: LiveClass['settings'];
}

interface ListParams {
  sectionId?: string;
  classId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  mine?: boolean;
  staffId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

class LiveClassService {
  async create(
    tenantId: string,
    branchId: string,
    userId: string,
    data: CreateInput,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<LiveClass> {
    const tenantOid = new ObjectId(tenantId);

    // Resolve the actual host. Admins may schedule for another teacher; everyone
    // else hosts their own class regardless of what they post.
    const requestedHostStaffId = isAdmin && data.hostStaffId ? data.hostStaffId : actingStaffId;
    if (!requestedHostStaffId) {
      throw new ApiError('HOST_REQUIRED', 'A host teacher is required', 400);
    }

    // Lookup section/subject names for denormalisation
    const section = await collections.sections.findOne({
      _id: new ObjectId(data.sectionId),
      tenantId: tenantOid,
    });
    if (!section) throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);

    const classDoc = data.classId
      ? await collections.classes.findOne({ _id: new ObjectId(data.classId), tenantId: tenantOid })
      : null;

    const subject = data.subjectId
      ? await collections.subjects.findOne({
          _id: new ObjectId(data.subjectId),
          tenantId: tenantOid,
        })
      : null;

    const host = await collections.staff.findOne({
      _id: new ObjectId(requestedHostStaffId),
      tenantId: tenantOid,
    });
    if (!host) {
      throw new ApiError('HOST_NOT_FOUND', 'Host teacher not found', 404);
    }

    // Lock the class for the teacher when an admin scheduled it on someone
    // else's behalf. Self-scheduling (admin or teacher) leaves it editable.
    const lockedForHost = isAdmin && requestedHostStaffId !== actingStaffId;

    const _id = new ObjectId();
    const now = new Date();
    const doc: LiveClassDocument = {
      _id,
      tenantId: tenantOid,
      branchId: new ObjectId(branchId),
      title: data.title,
      description: data.description,
      classId: data.classId ? new ObjectId(data.classId) : null,
      sectionId: new ObjectId(data.sectionId),
      subjectId: data.subjectId ? new ObjectId(data.subjectId) : null,
      hostStaffId: new ObjectId(requestedHostStaffId),
      hostName: host
        ? (host.displayName as string) || `${host.firstName ?? ''} ${host.lastName ?? ''}`.trim()
        : undefined,
      coHostStaffIds: (data.coHostStaffIds ?? []).map((s) => new ObjectId(s)),
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      status: 'scheduled',
      provider: 'livekit',
      providerRoomName: `lc_${_id.toString()}`,
      recordingEnabled: data.recordingEnabled ?? false,
      autoMarkAttendance: data.autoMarkAttendance ?? false,
      attendanceThresholdPct: data.attendanceThresholdPct ?? 60,
      settings: data.settings ?? { chatEnabled: true, studentCanUnmute: false },
      className: classDoc ? (classDoc.name as string) : undefined,
      sectionName: section.name as string,
      subjectName: subject ? (subject.name as string) : undefined,
      lockedForHost,
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    await collections.liveClasses.insertOne(doc);
    logger.info(
      {
        liveClassId: _id.toString(),
        tenantId,
        hostStaffId: requestedHostStaffId,
        scheduledByUserId: userId,
        lockedForHost,
      },
      'Live class scheduled'
    );
    return this.format(doc);
  }

  async list(
    tenantId: string,
    branchId: string,
    params: ListParams
  ): Promise<{ data: LiveClass[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, sortBy, sortOrder } = getPagination({
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy ?? 'scheduledStart',
      sortOrder: params.sortOrder ?? 'desc',
    });

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (params.sectionId) filter.sectionId = new ObjectId(params.sectionId);
    if (params.classId) filter.classId = new ObjectId(params.classId);
    if (params.status) filter.status = params.status;
    if (params.staffId) {
      filter.$or = [
        { hostStaffId: new ObjectId(params.staffId) },
        { coHostStaffIds: new ObjectId(params.staffId) },
      ];
    }
    if (params.dateFrom || params.dateTo) {
      const range: Record<string, Date> = {};
      if (params.dateFrom) range.$gte = new Date(params.dateFrom);
      if (params.dateTo) range.$lte = new Date(params.dateTo);
      filter.scheduledStart = range;
    }
    if (params.search) {
      filter.title = { $regex: params.search, $options: 'i' };
    }

    const total = await collections.liveClasses.countDocuments(filter);
    const docs = await collections.liveClasses
      .find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return {
      data: docs.map((d) => this.format(d as WithId<LiveClassDocument>)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listForStudent(
    tenantId: string,
    userId: string,
    params: ListParams
  ): Promise<{ data: LiveClass[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const tenantOid = new ObjectId(tenantId);
    const student = await collections.students.findOne({
      tenantId: tenantOid,
      userId: new ObjectId(userId),
      status: 'active',
    });
    if (!student) {
      return { data: [], meta: buildPaginationMeta(1, 20, 0) };
    }
    return this.list(tenantId, (student.branchId as ObjectId).toString(), {
      ...params,
      sectionId: (student.sectionId as ObjectId)?.toString(),
    });
  }

  async getById(tenantId: string, id: string): Promise<LiveClass> {
    const doc = await collections.liveClasses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });
    if (!doc) throw new ApiError('LIVE_CLASS_NOT_FOUND', 'Live class not found', 404);
    return this.format(doc as WithId<LiveClassDocument>);
  }

  async update(
    tenantId: string,
    id: string,
    data: UpdateInput,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<LiveClass> {
    const doc = await collections.liveClasses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });
    if (!doc) throw new ApiError('LIVE_CLASS_NOT_FOUND', 'Live class not found', 404);
    if (doc.status === 'ended')
      throw new ApiError('LIVE_CLASS_ENDED', 'Cannot edit ended class', 400);

    if (!isAdmin && (doc.hostStaffId as ObjectId).toString() !== actingStaffId) {
      throw new ApiError('FORBIDDEN', 'Only the host can edit this live class', 403);
    }
    if (!isAdmin && doc.lockedForHost) {
      throw new ApiError(
        'LIVE_CLASS_LOCKED',
        'This live class was scheduled by an administrator and can only be edited by an admin.',
        403
      );
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.scheduledStart !== undefined) update.scheduledStart = data.scheduledStart;
    if (data.scheduledEnd !== undefined) update.scheduledEnd = data.scheduledEnd;
    if (data.coHostStaffIds !== undefined)
      update.coHostStaffIds = data.coHostStaffIds.map((s) => new ObjectId(s));
    if (data.recordingEnabled !== undefined) update.recordingEnabled = data.recordingEnabled;
    if (data.autoMarkAttendance !== undefined) update.autoMarkAttendance = data.autoMarkAttendance;
    if (data.attendanceThresholdPct !== undefined)
      update.attendanceThresholdPct = data.attendanceThresholdPct;
    if (data.settings !== undefined) update.settings = data.settings;

    await collections.liveClasses.updateOne({ _id: doc._id }, { $set: update });
    return this.getById(tenantId, id);
  }

  async cancel(
    tenantId: string,
    id: string,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<void> {
    const doc = await collections.liveClasses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });
    if (!doc) throw new ApiError('LIVE_CLASS_NOT_FOUND', 'Live class not found', 404);
    if (doc.status === 'live' || doc.status === 'ended')
      throw new ApiError('LIVE_CLASS_ACTIVE', 'Cannot cancel a class that has started', 400);
    if (!isAdmin && (doc.hostStaffId as ObjectId).toString() !== actingStaffId) {
      throw new ApiError('FORBIDDEN', 'Only the host can cancel this live class', 403);
    }
    if (!isAdmin && doc.lockedForHost) {
      throw new ApiError(
        'LIVE_CLASS_LOCKED',
        'This live class was scheduled by an administrator and can only be cancelled by an admin.',
        403
      );
    }
    await collections.liveClasses.updateOne(
      { _id: doc._id },
      { $set: { status: 'cancelled', updatedAt: new Date() } }
    );
  }

  async start(
    tenantId: string,
    id: string,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<LiveClass> {
    const doc = await collections.liveClasses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });
    if (!doc) throw new ApiError('LIVE_CLASS_NOT_FOUND', 'Live class not found', 404);
    if (doc.status === 'ended') throw new ApiError('LIVE_CLASS_ENDED', 'Class already ended', 400);
    if (doc.status === 'cancelled')
      throw new ApiError('LIVE_CLASS_CANCELLED', 'Class is cancelled', 400);

    const isHostOrCohost =
      (doc.hostStaffId as ObjectId).toString() === actingStaffId ||
      ((doc.coHostStaffIds as ObjectId[] | undefined)?.some(
        (x) => x.toString() === actingStaffId
      ) ??
        false);
    if (!isAdmin && !isHostOrCohost) {
      throw new ApiError('FORBIDDEN', 'Only the host can start this live class', 403);
    }

    if (doc.status !== 'live') {
      await collections.liveClasses.updateOne(
        { _id: doc._id },
        { $set: { status: 'live', actualStart: new Date(), updatedAt: new Date() } }
      );
    }
    return this.getById(tenantId, id);
  }

  async end(
    tenantId: string,
    id: string,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<LiveClass> {
    const doc = await collections.liveClasses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });
    if (!doc) throw new ApiError('LIVE_CLASS_NOT_FOUND', 'Live class not found', 404);

    const isHostOrCohost =
      (doc.hostStaffId as ObjectId).toString() === actingStaffId ||
      ((doc.coHostStaffIds as ObjectId[] | undefined)?.some(
        (x) => x.toString() === actingStaffId
      ) ??
        false);
    if (!isAdmin && !isHostOrCohost) {
      throw new ApiError('FORBIDDEN', 'Only the host can end this live class', 403);
    }

    const endedAt = new Date();
    await collections.liveClasses.updateOne(
      { _id: doc._id },
      { $set: { status: 'ended', actualEnd: endedAt, updatedAt: endedAt } }
    );
    // Force-close any live polls
    await collections.liveClassPolls.updateMany(
      { liveClassId: doc._id, status: 'live' },
      { $set: { status: 'closed', closedAt: endedAt } }
    );

    // Auto-mark attendance if enabled
    if (doc.autoMarkAttendance) {
      try {
        await this.deriveAttendance(doc._id.toString(), endedAt);
      } catch (e) {
        logger.error({ err: e, liveClassId: id }, 'Auto-attendance derivation failed');
      }
    }

    // Persist final whiteboard snapshot (best-effort)
    try {
      await finalizeWhiteboard(doc._id.toString());
    } catch (e) {
      logger.warn({ err: e, liveClassId: id }, 'Final whiteboard snapshot failed');
    }

    return this.getById(tenantId, id);
  }

  /**
   * Derive attendance from live class participation:
   *  - present  → joined for >= thresholdPct of the class
   *  - late     → joined for >0 but below threshold
   *  - absent   → enrolled but never joined
   */
  async deriveAttendance(liveClassId: string, endedAt: Date): Promise<void> {
    const lcOid = new ObjectId(liveClassId);
    const lc = await collections.liveClasses.findOne({ _id: lcOid });
    if (!lc) return;

    const startedAt = (lc.actualStart as Date | undefined) ?? (lc.scheduledStart as Date);
    const durationMs = Math.max(1, endedAt.getTime() - startedAt.getTime());
    const threshold = ((lc.attendanceThresholdPct as number | undefined) ?? 60) / 100;

    // Resolve classId: if not on the live class, look up from the section
    let classId = lc.classId as ObjectId | null | undefined;
    if (!classId) {
      const section = await collections.sections.findOne({
        _id: lc.sectionId as ObjectId,
        tenantId: lc.tenantId as ObjectId,
      });
      classId = section?.classId as ObjectId | undefined;
    }
    if (!classId) {
      logger.warn({ liveClassId }, 'No classId — skipping attendance');
      return;
    }

    // All active enrolled students for the section
    const enrolled = await collections.students
      .find({
        tenantId: lc.tenantId as ObjectId,
        sectionId: lc.sectionId as ObjectId,
        status: 'active',
      })
      .project({ _id: 1, userId: 1 })
      .toArray();
    if (enrolled.length === 0) return;

    // Participant durations keyed by userId
    const participants = await collections.liveClassParticipants
      .find({ liveClassId: lcOid, role: 'student' })
      .toArray();
    const durationByUserId: Record<string, number> = {};
    for (const p of participants) {
      const joined = p.joinedAt as Date;
      const left = (p.leftAt as Date | undefined) ?? endedAt;
      durationByUserId[(p.userId as ObjectId).toString()] = Math.max(
        0,
        left.getTime() - joined.getTime()
      );
    }

    type AR = {
      studentId: ObjectId;
      status: 'present' | 'absent' | 'late';
      remarks?: string;
    };
    const records: AR[] = enrolled.map((s) => {
      const dur = durationByUserId[(s.userId as ObjectId)?.toString() ?? ''] ?? 0;
      const ratio = dur / durationMs;
      if (dur === 0) return { studentId: s._id, status: 'absent' as const };
      if (ratio >= threshold)
        return {
          studentId: s._id,
          status: 'present' as const,
          remarks: `Live class · ${Math.round(ratio * 100)}%`,
        };
      return {
        studentId: s._id,
        status: 'late' as const,
        remarks: `Live class · ${Math.round(ratio * 100)}%`,
      };
    });

    const dateOnly = new Date(endedAt);
    dateOnly.setHours(0, 0, 0, 0);

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      late: records.filter((r) => r.status === 'late').length,
      halfDay: 0,
      leave: 0,
    };

    // Upsert the attendance doc, but never overwrite if it's locked
    const filter = {
      tenantId: lc.tenantId as ObjectId,
      branchId: lc.branchId as ObjectId,
      classId,
      sectionId: lc.sectionId as ObjectId,
      date: dateOnly,
    };
    const existing = await collections.studentAttendance.findOne(filter);
    if (existing && existing.isLocked) {
      logger.info({ liveClassId }, 'Attendance is locked; skipping auto-mark');
      return;
    }

    if (existing) {
      await collections.studentAttendance.updateOne(
        { _id: existing._id },
        {
          $set: {
            records,
            summary,
            lastModifiedBy: lc.createdBy as ObjectId,
            lastModifiedAt: new Date(),
          },
        }
      );
    } else {
      await collections.studentAttendance.insertOne({
        _id: new ObjectId(),
        ...filter,
        records,
        summary,
        markedBy: lc.createdBy as ObjectId,
        markedAt: new Date(),
        isLocked: false,
        sourceLiveClassId: lcOid,
      });
    }

    await collections.liveClasses.updateOne(
      { _id: lcOid },
      { $set: { attendanceMarkedAt: new Date() } }
    );

    logger.info(
      {
        liveClassId,
        present: summary.present,
        late: summary.late,
        absent: summary.absent,
      },
      'Auto-marked attendance from live class'
    );
  }

  /**
   * Verify access and mint a LiveKit access token.
   * Auto-flips status to 'live' if a host/cohost joins.
   */
  async join(
    tenantId: string,
    userId: string,
    id: string,
    isAdmin: boolean
  ): Promise<LiveClassJoinResponse> {
    if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      throw new ApiError('LIVEKIT_NOT_CONFIGURED', 'LiveKit is not configured on this server', 500);
    }

    const tenantOid = new ObjectId(tenantId);
    const doc = await collections.liveClasses.findOne({
      _id: new ObjectId(id),
      tenantId: tenantOid,
    });
    if (!doc) throw new ApiError('LIVE_CLASS_NOT_FOUND', 'Live class not found', 404);
    if (doc.status === 'cancelled')
      throw new ApiError('LIVE_CLASS_CANCELLED', 'Class is cancelled', 400);
    if (doc.status === 'ended') throw new ApiError('LIVE_CLASS_ENDED', 'Class has ended', 400);

    // Determine role
    let role: LiveClassRole = 'student';
    let displayName = '';
    let staffId: string | undefined;

    const staff = await collections.staff.findOne({
      tenantId: tenantOid,
      userId: new ObjectId(userId),
      status: 'active',
    });

    if (staff) {
      staffId = staff._id.toString();
      const hostId = (doc.hostStaffId as ObjectId).toString();
      const coHostIds =
        (doc.coHostStaffIds as ObjectId[] | undefined)?.map((x) => x.toString()) ?? [];
      if (staffId === hostId) role = 'host';
      else if (coHostIds.includes(staffId) || isAdmin) role = 'cohost';

      displayName =
        (staff.displayName as string) || `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim();
    } else if (isAdmin) {
      role = 'cohost';
      const user = await collections.users.findOne({ _id: new ObjectId(userId) });
      // A user's name lives under `profile`, not at the top level — fall back to
      // email only when no name is set.
      const profile = user?.profile as
        | { firstName?: string; lastName?: string; displayName?: string }
        | undefined;
      displayName =
        profile?.displayName ||
        `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() ||
        (user?.email as string) ||
        'Admin';
    } else {
      // Student check — match on the CURRENT enrollment section (top-level
      // sectionId can be stale after a promotion/shuffle).
      const student = await collections.students.findOne({
        tenantId: tenantOid,
        userId: new ObjectId(userId),
        status: 'active',
      });
      const enrolledSectionId = (
        (student?.currentEnrollment as { sectionId?: ObjectId })?.sectionId ??
        (student?.sectionId as ObjectId | undefined)
      )?.toString();
      if (!student || enrolledSectionId !== (doc.sectionId as ObjectId).toString())
        throw new ApiError('LIVE_CLASS_FORBIDDEN', 'You are not enrolled in this section', 403);
      role = 'student';
      displayName =
        `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() ||
        (student.email as string) ||
        'Student';
    }

    // Auto-start if host/cohost joins a scheduled class
    if ((role === 'host' || role === 'cohost') && doc.status === 'scheduled') {
      await collections.liveClasses.updateOne(
        { _id: doc._id },
        { $set: { status: 'live', actualStart: new Date(), updatedAt: new Date() } }
      );
    }

    // Mint LiveKit token
    const identity = `${userId}_${role}`;
    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity,
      name: displayName,
      ttl: '4h',
    });
    at.addGrant({
      room: doc.providerRoomName as string,
      roomJoin: true,
      canPublish: role !== 'student' || doc.settings?.studentCanUnmute === true,
      canSubscribe: true,
      canPublishData: true,
    });
    const livekitToken = await at.toJwt();

    return {
      liveClassId: id,
      livekitUrl: env.LIVEKIT_URL,
      livekitToken,
      socketUrl: env.API_URL,
      role,
      identity,
      displayName,
    };
  }

  async listMessages(tenantId: string, id: string, params: { page?: number; limit?: number }) {
    const { page, limit } = getPagination({
      page: params.page,
      limit: params.limit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      liveClassId: new ObjectId(id),
      deletedAt: { $exists: false },
    };
    const total = await collections.liveClassMessages.countDocuments(filter);
    const docs = await collections.liveClassMessages
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    return {
      data: docs.map((m) => ({
        _id: m._id.toString(),
        senderUserId: (m.senderUserId as ObjectId).toString(),
        senderName: m.senderName,
        senderRole: m.senderRole,
        text: m.text,
        createdAt: m.createdAt,
      })),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listPolls(tenantId: string, id: string) {
    const polls = await collections.liveClassPolls
      .find({
        tenantId: new ObjectId(tenantId),
        liveClassId: new ObjectId(id),
      })
      .sort({ launchedAt: -1 })
      .toArray();

    const out = [];
    for (const p of polls) {
      const responses = await collections.liveClassPollResponses.find({ pollId: p._id }).toArray();
      const opts = p.options as { text: string; isCorrect?: boolean }[];
      const counts = opts.map(() => 0);
      for (const r of responses) {
        for (const idx of (r.selectedIndices as number[]) ?? []) {
          if (counts[idx] !== undefined) counts[idx]++;
        }
      }
      out.push({
        _id: p._id.toString(),
        question: p.question,
        type: p.type,
        durationSec: p.durationSec,
        launchedAt: p.launchedAt,
        closesAt: p.closesAt,
        closedAt: p.closedAt,
        status: p.status,
        results: opts.map((o, i) => ({ text: o.text, isCorrect: !!o.isCorrect, count: counts[i] })),
        totalResponses: responses.length,
      });
    }
    return out;
  }

  // -------- LiveKit room/egress helpers ----------------------------------

  /** Lazy LiveKit clients. We don't create them at boot because some envs
   *  (CI, local dev without LiveKit creds) skip the live-class feature. */
  private roomClient: RoomServiceClient | null = null;
  private egressClient: EgressClient | null = null;

  private getRoomClient(): RoomServiceClient {
    if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      throw new ApiError('LIVEKIT_NOT_CONFIGURED', 'LiveKit is not configured on this server', 500);
    }
    if (!this.roomClient) {
      this.roomClient = new RoomServiceClient(
        env.LIVEKIT_URL,
        env.LIVEKIT_API_KEY,
        env.LIVEKIT_API_SECRET
      );
    }
    return this.roomClient;
  }

  private getEgressClient(): EgressClient {
    if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
      throw new ApiError('LIVEKIT_NOT_CONFIGURED', 'LiveKit is not configured on this server', 500);
    }
    if (!this.egressClient) {
      this.egressClient = new EgressClient(
        env.LIVEKIT_URL,
        env.LIVEKIT_API_KEY,
        env.LIVEKIT_API_SECRET
      );
    }
    return this.egressClient;
  }

  /** Find the LiveKit doc and verify the acting staff is host/cohost (admins always pass). */
  private async assertHostControl(
    tenantId: string,
    id: string,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<WithId<LiveClassDocument>> {
    const doc = (await collections.liveClasses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<LiveClassDocument> | null;
    if (!doc) throw new ApiError('LIVE_CLASS_NOT_FOUND', 'Live class not found', 404);
    if (doc.status !== 'live') throw new ApiError('LIVE_CLASS_NOT_LIVE', 'Class is not live', 400);

    const isHostOrCohost =
      doc.hostStaffId.toString() === actingStaffId ||
      (doc.coHostStaffIds?.some((x) => x.toString() === actingStaffId) ?? false);
    if (!isAdmin && !isHostOrCohost) {
      throw new ApiError('FORBIDDEN', 'Only the host or co-hosts can do this', 403);
    }
    return doc;
  }

  private emitToRoom(tenantId: string, id: string, event: string, payload: unknown): void {
    try {
      getIO().to(`live:${tenantId}:${id}`).emit(event, payload);
    } catch (err) {
      // Socket.IO not initialised in this process (e.g. test), don't throw.
      logger.debug({ err }, 'emitToRoom: socket.io unavailable');
    }
  }

  /**
   * Remove a participant from the LiveKit room. We don't know whether they
   * joined as student/cohost/etc., so we list current room participants and
   * remove the one whose identity starts with `{userId}_`.
   */
  async kickParticipant(
    tenantId: string,
    id: string,
    targetUserId: string,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<void> {
    const doc = await this.assertHostControl(tenantId, id, actingStaffId, isAdmin);
    const roomName = doc.providerRoomName;
    const room = this.getRoomClient();

    let removedIdentity: string | undefined;
    try {
      const participants = await room.listParticipants(roomName);
      const target = participants.find((p) => p.identity.startsWith(`${targetUserId}_`));
      if (target) {
        await room.removeParticipant(roomName, target.identity);
        removedIdentity = target.identity;
      }
    } catch (err) {
      logger.error({ err, liveClassId: id, targetUserId }, 'LiveKit removeParticipant failed');
      throw new ApiError('KICK_FAILED', 'Failed to remove participant', 502);
    }

    // Tell the room (and the kicked client) so the UI can react instantly.
    this.emitToRoom(tenantId, id, 'presence:kicked', {
      userId: targetUserId,
      identity: removedIdentity,
      kickedByStaffId: actingStaffId,
    });

    await collections.liveClassParticipants.updateOne(
      { liveClassId: doc._id, userId: new ObjectId(targetUserId) },
      {
        $set: {
          leftAt: new Date(),
          lastSeenAt: new Date(),
          kickedByStaffId: new ObjectId(actingStaffId),
        },
      }
    );

    await collections.auditLogs
      .insertOne({
        _id: new ObjectId(),
        tenantId: doc.tenantId,
        userId: new ObjectId(actingStaffId),
        action: 'live_class.kick',
        targetType: 'live_class',
        targetId: doc._id,
        metadata: { targetUserId, identity: removedIdentity },
        createdAt: new Date(),
      })
      .catch((err) => logger.warn({ err }, 'audit log write failed (kick)'));
  }

  /**
   * Mute every published audio track for non-host identities. LiveKit's
   * `mutePublishedTrack` is per-track, so we iterate over each participant's
   * tracks. Best-effort — failures on individual tracks don't abort the rest.
   */
  async muteAll(
    tenantId: string,
    id: string,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<{ mutedCount: number }> {
    const doc = await this.assertHostControl(tenantId, id, actingStaffId, isAdmin);
    const room = this.getRoomClient();
    const roomName = doc.providerRoomName;

    let mutedCount = 0;
    try {
      const participants = await room.listParticipants(roomName);
      for (const p of participants) {
        // Skip hosts/cohosts. Identities are minted as `{userId}_{role}` in join().
        if (p.identity.endsWith('_host') || p.identity.endsWith('_cohost')) continue;
        for (const track of p.tracks ?? []) {
          if (track.muted) continue;
          try {
            await room.mutePublishedTrack(roomName, p.identity, track.sid, true);
            mutedCount++;
          } catch (err) {
            logger.warn(
              { err, identity: p.identity, trackSid: track.sid },
              'mutePublishedTrack failed'
            );
          }
        }
      }
    } catch (err) {
      logger.error({ err, liveClassId: id }, 'LiveKit listParticipants failed during muteAll');
      throw new ApiError('MUTE_ALL_FAILED', 'Failed to mute participants', 502);
    }

    this.emitToRoom(tenantId, id, 'control:mute-all', {
      mutedCount,
      byStaffId: actingStaffId,
    });

    await collections.auditLogs
      .insertOne({
        _id: new ObjectId(),
        tenantId: doc.tenantId,
        userId: new ObjectId(actingStaffId),
        action: 'live_class.mute_all',
        targetType: 'live_class',
        targetId: doc._id,
        metadata: { mutedCount },
        createdAt: new Date(),
      })
      .catch((err) => logger.warn({ err }, 'audit log write failed (mute_all)'));

    return { mutedCount };
  }

  /**
   * Patch in-call settings (chat, student unmute, student draw, recording flag).
   * Recording start/stop is a separate call; this only flips the *flag*.
   */
  async updateLiveSettings(
    tenantId: string,
    id: string,
    settings: {
      chatEnabled?: boolean;
      studentCanUnmute?: boolean;
      studentCanDraw?: boolean;
      recordingEnabled?: boolean;
    },
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<LiveClass> {
    const doc = await this.assertHostControl(tenantId, id, actingStaffId, isAdmin);
    const merged = { ...(doc.settings ?? {}), ...settings };
    await collections.liveClasses.updateOne(
      { _id: doc._id },
      { $set: { settings: merged, updatedAt: new Date() } }
    );

    this.emitToRoom(tenantId, id, 'settings:updated', { settings: merged });

    await collections.auditLogs
      .insertOne({
        _id: new ObjectId(),
        tenantId: doc.tenantId,
        userId: new ObjectId(actingStaffId),
        action: 'live_class.settings_update',
        targetType: 'live_class',
        targetId: doc._id,
        metadata: { settings },
        createdAt: new Date(),
      })
      .catch((err) => logger.warn({ err }, 'audit log write failed (settings_update)'));

    return this.getById(tenantId, id);
  }

  /**
   * Start recording the room via LiveKit room-composite egress. We persist
   * the returned `egressId` so we can stop it later. Idempotent: if a
   * recording is already in flight, returns the existing egress id.
   */
  async startRecording(
    tenantId: string,
    id: string,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<{ egressId: string; status: 'pending' | 'ready' | 'failed' }> {
    const doc = await this.assertHostControl(tenantId, id, actingStaffId, isAdmin);
    if (doc.recordingEgressId && doc.recordingStatus === 'pending') {
      return { egressId: doc.recordingEgressId, status: 'pending' };
    }
    if (!env.LIVEKIT_RECORDING_S3_BUCKET) {
      throw new ApiError(
        'RECORDING_NOT_CONFIGURED',
        'Recording storage is not configured on this server',
        500
      );
    }

    const egress = this.getEgressClient();
    const fileOutput: EncodedFileOutput = {
      fileType: EncodedFileType.MP4,
      filepath: `live-classes/${tenantId}/${id}/${Date.now()}.mp4`,
      output: {
        case: 's3',
        value: {
          accessKey: env.AWS_ACCESS_KEY_ID ?? '',
          secret: env.AWS_SECRET_ACCESS_KEY ?? '',
          bucket: env.LIVEKIT_RECORDING_S3_BUCKET,
          region: env.AWS_REGION ?? 'us-east-1',
        },
      },
    } as unknown as EncodedFileOutput;

    let egressId: string;
    try {
      const opts: RoomCompositeOptions = { layout: 'speaker' };
      const info = await egress.startRoomCompositeEgress(doc.providerRoomName, fileOutput, opts);
      egressId = info.egressId;
    } catch (err) {
      logger.error({ err, liveClassId: id }, 'LiveKit startRoomCompositeEgress failed');
      throw new ApiError('RECORDING_START_FAILED', 'Failed to start recording', 502);
    }

    await collections.liveClasses.updateOne(
      { _id: doc._id },
      {
        $set: {
          recordingEgressId: egressId,
          recordingStatus: 'pending',
          recordingEnabled: true,
          updatedAt: new Date(),
        },
      }
    );

    this.emitToRoom(tenantId, id, 'recording:state', { state: 'starting', egressId });

    await collections.auditLogs
      .insertOne({
        _id: new ObjectId(),
        tenantId: doc.tenantId,
        userId: new ObjectId(actingStaffId),
        action: 'live_class.recording_start',
        targetType: 'live_class',
        targetId: doc._id,
        metadata: { egressId },
        createdAt: new Date(),
      })
      .catch((err) => logger.warn({ err }, 'audit log write failed (recording_start)'));

    return { egressId, status: 'pending' };
  }

  /**
   * Stop the in-flight recording. The webhook (`egress_ended`) will set the
   * final URL + `recordingStatus: ready`. We just request the stop here.
   */
  async stopRecording(
    tenantId: string,
    id: string,
    actingStaffId: string,
    isAdmin: boolean
  ): Promise<void> {
    const doc = await this.assertHostControl(tenantId, id, actingStaffId, isAdmin);
    if (!doc.recordingEgressId) {
      throw new ApiError('RECORDING_NOT_ACTIVE', 'No recording is currently active', 400);
    }

    try {
      await this.getEgressClient().stopEgress(doc.recordingEgressId);
    } catch (err) {
      logger.error(
        { err, liveClassId: id, egressId: doc.recordingEgressId },
        'LiveKit stopEgress failed'
      );
      throw new ApiError('RECORDING_STOP_FAILED', 'Failed to stop recording', 502);
    }

    this.emitToRoom(tenantId, id, 'recording:state', {
      state: 'stopping',
      egressId: doc.recordingEgressId,
    });

    await collections.auditLogs
      .insertOne({
        _id: new ObjectId(),
        tenantId: doc.tenantId,
        userId: new ObjectId(actingStaffId),
        action: 'live_class.recording_stop',
        targetType: 'live_class',
        targetId: doc._id,
        metadata: { egressId: doc.recordingEgressId },
        createdAt: new Date(),
      })
      .catch((err) => logger.warn({ err }, 'audit log write failed (recording_stop)'));
  }

  async listParticipants(tenantId: string, id: string) {
    const docs = await collections.liveClassParticipants
      .find({ tenantId: new ObjectId(tenantId), liveClassId: new ObjectId(id) })
      .toArray();
    return docs.map((p) => ({
      _id: p._id.toString(),
      userId: (p.userId as ObjectId).toString(),
      role: p.role,
      displayName: p.displayName,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      lastSeenAt: p.lastSeenAt,
    }));
  }

  private format(doc: WithId<LiveClassDocument>): LiveClass {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      title: doc.title,
      description: doc.description,
      classId: doc.classId ? doc.classId.toString() : undefined,
      sectionId: doc.sectionId.toString(),
      subjectId: doc.subjectId ? doc.subjectId.toString() : undefined,
      hostStaffId: doc.hostStaffId.toString(),
      hostName: doc.hostName,
      coHostStaffIds: doc.coHostStaffIds?.map((x) => x.toString()),
      scheduledStart: doc.scheduledStart,
      scheduledEnd: doc.scheduledEnd,
      actualStart: doc.actualStart,
      actualEnd: doc.actualEnd,
      status: doc.status,
      provider: doc.provider,
      providerRoomName: doc.providerRoomName,
      recordingUrl: doc.recordingUrl,
      recordingStatus: doc.recordingStatus,
      recordingEnabled: doc.recordingEnabled,
      autoMarkAttendance: doc.autoMarkAttendance,
      attendanceThresholdPct: doc.attendanceThresholdPct,
      attendanceMarkedAt: doc.attendanceMarkedAt,
      settings: doc.settings,
      className: doc.className,
      sectionName: doc.sectionName,
      subjectName: doc.subjectName,
      scheduledByUserId: doc.createdBy ? doc.createdBy.toString() : undefined,
      lockedForHost: doc.lockedForHost ?? false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const liveClassService = new LiveClassService();
export { getStaffIdForUser };
