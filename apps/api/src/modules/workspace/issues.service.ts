import { ObjectId } from 'mongodb';
import { getDb } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { generateSequence, padSequence } from '../../utils/generators';
import { brief, chainAbove, loadPeople, manages, teamOf, type Person } from './hierarchy';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';

/** How long the current handler has before the issue escalates on its own. */
export const SLA_HOURS: Record<Severity, number> = { low: 168, medium: 72, high: 24, critical: 4 };

type Who = ReturnType<typeof brief>;
interface IssueUpdate {
  at: Date;
  by?: Who; // absent for the system's own auto-escalation
  kind: 'raised' | 'comment' | 'status' | 'escalated' | 'delegated' | 'auto_escalated' | 'reopened';
  text?: string;
  to?: string;
  handler?: Who;
}
export interface IssueDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  number: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  status: IssueStatus;
  raisedBy: Who;
  handler: Who;
  /** Everyone who has held the issue, in order — the escalation path so far. */
  trail: Array<{ who: Who; at: Date; via: 'raised' | 'escalated' | 'delegated' | 'auto_escalated' }>;
  slaDueAt: Date;
  resolution?: string;
  resolvedAt?: Date;
  updates: IssueUpdate[];
  createdAt: Date;
  updatedAt: Date;
}

const issues = () => getDb().collection<IssueDoc>('issues');
const ACTIVE: IssueStatus[] = ['open', 'acknowledged', 'in_progress'];
const due = (s: Severity, from = new Date()) => new Date(from.getTime() + SLA_HOURS[s] * 3600_000);

const me = (people: Person[], userId: string) => {
  const p = people.find((x) => x.userId === userId);
  if (!p) throw new ApiError('NOT_STAFF', 'Issues are for staff accounts', 403);
  return p;
};
const find = (people: Person[], userId: string) => people.find((p) => p.userId === userId);

export interface RaiseIssueInput {
  title: string;
  description: string;
  category: string;
  severity: Severity;
  /** Optional: skip straight to someone further up the chain. */
  toUserId?: string;
}

function canSee(i: IssueDoc, viewer: Person, people: Person[]) {
  if (i.raisedBy.userId === viewer.userId || i.trail.some((t) => t.who.userId === viewer.userId)) return true;
  const handler = find(people, i.handler.userId);
  const raiser = find(people, i.raisedBy.userId);
  return (!!handler && manages(viewer, handler)) || (!!raiser && manages(viewer, raiser));
}

function view(i: IssueDoc, viewer: Person, people: Person[]) {
  const handler = find(people, i.handler.userId);
  const isHandler = i.handler.userId === viewer.userId;
  const isRaiser = i.raisedBy.userId === viewer.userId;
  const active = ACTIVE.includes(i.status);
  const breached = active && i.slaDueAt.getTime() < Date.now();
  const next = handler ? chainAbove(handler, people)[0] : undefined;
  // Someone above the handler can take the issue over.
  const above = !!handler && manages(viewer, handler);
  return {
    ...i,
    _id: String(i._id),
    tenantId: undefined,
    breached,
    nextUp: next ? brief(next) : null,
    can: {
      handle: (isHandler || above) && active,
      escalate: active && !!next && (isHandler || (isRaiser && breached)),
      delegate: isHandler && active,
      close: isRaiser && (i.status === 'resolved' || active),
      reopen: isRaiser && i.status === 'resolved',
      takeOver: above && !isHandler && active,
    },
  };
}

class IssuesService {
  /** Who an issue raised by this user would go to, nearest first. */
  async route(tenantId: string, userId: string) {
    const people = await loadPeople(tenantId);
    return chainAbove(me(people, userId), people).map(brief);
  }

  async raise(tenantId: string, userId: string, input: RaiseIssueInput) {
    const people = await loadPeople(tenantId);
    const raiser = me(people, userId);
    const chain = chainAbove(raiser, people);
    if (!chain.length) throw new ApiError('NO_ONE_ABOVE', 'There’s no one above you to raise this to', 400);
    const handler = input.toUserId ? chain.find((c) => c.userId === input.toUserId) : chain[0];
    if (!handler) throw new ApiError('NOT_IN_CHAIN', 'You can only raise issues to people above you', 400);

    const now = new Date();
    const seq = await generateSequence('workIssue', tenantId);
    const doc: IssueDoc = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      number: `ISS-${padSequence(seq, 4)}`,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      severity: input.severity,
      status: 'open',
      raisedBy: brief(raiser),
      handler: brief(handler),
      trail: [{ who: brief(handler), at: now, via: 'raised' }],
      slaDueAt: due(input.severity, now),
      updates: [{ at: now, by: brief(raiser), kind: 'raised', handler: brief(handler) }],
      createdAt: now,
      updatedAt: now,
    };
    await issues().insertOne(doc);
    return view(doc, raiser, people);
  }

  /**
   * Anything whose SLA ran out moves one step up the chain by itself, so an
   * issue can't sit ignored. Runs lazily whenever issues are listed.
   * ponytail: lazy sweep on read; move to the scheduler if nobody opens the page for days.
   */
  private async sweep(tenantId: string, people: Person[]) {
    const now = new Date();
    const overdue = await issues()
      .find({ tenantId: new ObjectId(tenantId), status: { $in: ACTIVE }, slaDueAt: { $lt: now } })
      .limit(50)
      .toArray();
    for (const i of overdue) {
      const handler = find(people, i.handler.userId);
      const next = handler ? chainAbove(handler, people)[0] : undefined;
      if (!next) {
        // Top of the chain already: stop re-checking until it's touched again.
        await issues().updateOne({ _id: i._id }, { $set: { slaDueAt: due(i.severity, now) } });
        continue;
      }
      await issues().updateOne(
        { _id: i._id, 'handler.userId': i.handler.userId },
        {
          $set: { handler: brief(next), status: 'open', slaDueAt: due(i.severity, now), updatedAt: now },
          $push: {
            trail: { who: brief(next), at: now, via: 'auto_escalated' },
            updates: { at: now, kind: 'auto_escalated', handler: brief(next), text: `No response from ${i.handler.name} in time` },
          },
        }
      );
    }
  }

  /** raised: by me · assigned: I'm handling · team: involving people below me. */
  async list(tenantId: string, userId: string, scope: 'raised' | 'assigned' | 'team', status?: string) {
    const people = await loadPeople(tenantId);
    const viewer = me(people, userId);
    await this.sweep(tenantId, people);
    const filter: Record<string, unknown> = { tenantId: new ObjectId(tenantId) };
    if (scope === 'raised') filter['raisedBy.userId'] = userId;
    else if (scope === 'assigned') filter['handler.userId'] = userId;
    else {
      const team = teamOf(viewer, people).map((p) => p.userId);
      filter.$or = [{ 'raisedBy.userId': { $in: team } }, { 'handler.userId': { $in: team } }, { 'trail.who.userId': userId }];
    }
    if (status) filter.status = { $in: status.split(',') };
    const rows = await issues().find(filter, { projection: { updates: 0 } }).sort({ updatedAt: -1 }).limit(500).toArray();
    return rows.map((i) => view({ ...i, updates: [] }, viewer, people));
  }

  async get(tenantId: string, userId: string, id: string) {
    const people = await loadPeople(tenantId);
    const viewer = me(people, userId);
    const i = await this.load(tenantId, id);
    if (!canSee(i, viewer, people)) throw new ApiError('ISSUE_NOT_FOUND', 'Issue not found', 404);
    const v = view(i, viewer, people);
    const handler = find(people, i.handler.userId);
    return {
      ...v,
      // Where it would go next, all the way up — drawn as the chain in the UI.
      ahead: handler ? chainAbove(handler, people).map(brief) : [],
      // People the handler can hand it down to.
      delegates: v.can.delegate && handler ? teamOf(handler, people).slice(0, 200).map(brief) : [],
    };
  }

  private async load(tenantId: string, id: string) {
    if (!ObjectId.isValid(id)) throw new ApiError('ISSUE_NOT_FOUND', 'Issue not found', 404);
    const i = await issues().findOne({ _id: new ObjectId(id), tenantId: new ObjectId(tenantId) });
    if (!i) throw new ApiError('ISSUE_NOT_FOUND', 'Issue not found', 404);
    return i;
  }

  async act(
    tenantId: string,
    userId: string,
    id: string,
    action:
      | { type: 'comment'; text: string }
      | { type: 'acknowledge' }
      | { type: 'start' }
      | { type: 'resolve'; resolution: string }
      | { type: 'escalate'; note?: string }
      | { type: 'delegate'; toUserId: string; note?: string }
      | { type: 'take_over' }
      | { type: 'close' }
      | { type: 'reopen'; note?: string }
  ) {
    const people = await loadPeople(tenantId);
    const viewer = me(people, userId);
    const i = await this.load(tenantId, id);
    if (!canSee(i, viewer, people)) throw new ApiError('ISSUE_NOT_FOUND', 'Issue not found', 404);
    const v = view(i, viewer, people);
    const now = new Date();
    const by = brief(viewer);
    const set: Partial<IssueDoc> = { updatedAt: now };
    const push: { updates: IssueUpdate; trail?: IssueDoc['trail'][number] } = { updates: { at: now, by, kind: 'status' } };
    const deny = (msg: string) => new ApiError('NOT_ALLOWED', msg, 403);
    const handTo = (p: Person, via: 'escalated' | 'delegated', note?: string) => {
      set.handler = brief(p);
      set.status = 'open';
      set.slaDueAt = due(i.severity, now);
      push.trail = { who: brief(p), at: now, via };
      push.updates = { at: now, by, kind: via, handler: brief(p), text: note?.trim() || undefined };
    };

    switch (action.type) {
      case 'comment':
        if (!action.text.trim()) throw new ApiError('EMPTY', 'Write something first', 400);
        push.updates = { at: now, by, kind: 'comment', text: action.text.trim() };
        break;
      case 'acknowledge':
      case 'start':
        if (!v.can.handle) throw deny('Only the person handling this can update it');
        set.status = action.type === 'start' ? 'in_progress' : 'acknowledged';
        push.updates.to = set.status;
        break;
      case 'resolve':
        if (!v.can.handle) throw deny('Only the person handling this can resolve it');
        if (!action.resolution?.trim()) throw new ApiError('EMPTY', 'Say how it was resolved', 400);
        set.status = 'resolved';
        set.resolution = action.resolution.trim();
        set.resolvedAt = now;
        push.updates = { at: now, by, kind: 'status', to: 'resolved', text: set.resolution };
        break;
      case 'escalate': {
        if (!v.can.escalate) throw deny('This can’t be escalated by you right now');
        const next = find(people, v.nextUp!.userId)!;
        handTo(next, 'escalated', action.note);
        break;
      }
      case 'delegate': {
        if (!v.can.delegate) throw deny('Only the person handling this can hand it on');
        const to = find(people, action.toUserId);
        if (!to || !manages(viewer, to)) throw deny('You can only hand issues to people below you');
        handTo(to, 'delegated', action.note);
        break;
      }
      case 'take_over':
        if (!v.can.takeOver) throw deny('You can’t take this over');
        handTo(viewer, 'escalated', `${viewer.name} took this over`);
        break;
      case 'close':
        if (!v.can.close) throw deny('Only the person who raised this can close it');
        set.status = 'closed';
        push.updates.to = 'closed';
        break;
      case 'reopen':
        if (!v.can.reopen) throw deny('Only the person who raised this can reopen it');
        set.status = 'open';
        set.slaDueAt = due(i.severity, now);
        push.updates = { at: now, by, kind: 'reopened', text: action.note?.trim() || undefined };
        break;
    }
    await issues().updateOne({ _id: i._id }, { $set: set, $push: push });
    return this.get(tenantId, userId, id);
  }

  async summary(tenantId: string, userId: string) {
    const t = new ObjectId(tenantId);
    const now = new Date();
    const [assigned, breached, raised] = await Promise.all([
      issues().countDocuments({ tenantId: t, 'handler.userId': userId, status: { $in: ACTIVE } }),
      issues().countDocuments({ tenantId: t, 'handler.userId': userId, status: { $in: ACTIVE }, slaDueAt: { $lt: now } }),
      issues().countDocuments({ tenantId: t, 'raisedBy.userId': userId, status: { $in: [...ACTIVE, 'resolved'] } }),
    ]);
    return { assigned, breached, raised };
  }
}

export const issuesService = new IssuesService();
