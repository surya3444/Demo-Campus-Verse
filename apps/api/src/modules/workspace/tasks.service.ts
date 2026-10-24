import { ObjectId } from 'mongodb';
import { getDb } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { generateSequence, padSequence } from '../../utils/generators';
import { brief, loadPeople, manages, teamOf, type Person } from './hierarchy';

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

type Who = ReturnType<typeof brief>;
interface TaskUpdate {
  at: Date;
  by: Who;
  kind: 'created' | 'comment' | 'status' | 'progress' | 'checklist' | 'edited';
  text?: string;
  from?: string;
  to?: string;
}
export interface TaskDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  number: string;
  groupId?: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: Date;
  requireReview: boolean;
  status: TaskStatus;
  progress: number;
  checklist: Array<{ id: string; text: string; done: boolean }>;
  assignedBy: Who;
  assignee: Who;
  updates: TaskUpdate[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const tasks = () => getDb().collection<TaskDoc>('workTasks');

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  requireReview?: boolean;
  checklist?: string[];
  assigneeIds: string[];
}

const me = (people: Person[], userId: string) => {
  const p = people.find((x) => x.userId === userId);
  if (!p) throw new ApiError('NOT_STAFF', 'Tasks are for staff accounts', 403);
  return p;
};

/** Task view for the client, with what the viewer may do with it. */
function view(t: TaskDoc, viewer: Person, people: Person[]) {
  const assignee = people.find((p) => p.userId === t.assignee.userId);
  const isAssignee = t.assignee.userId === viewer.userId;
  const isAssigner = t.assignedBy.userId === viewer.userId;
  const isAbove = !!assignee && manages(viewer, assignee);
  const open = t.status !== 'done' && t.status !== 'cancelled';
  return {
    ...t,
    _id: String(t._id),
    tenantId: undefined,
    overdue: open && !!t.dueDate && t.dueDate.getTime() < Date.now(),
    can: {
      work: isAssignee && open,
      review: (isAssigner || isAbove) && t.status === 'in_review',
      manage: (isAssigner || isAbove) && open,
      reopen: (isAssigner || isAbove) && t.status === 'done',
    },
  };
}

class TasksService {
  /** People this user may assign to — everyone below them in their scope. */
  async assignable(tenantId: string, userId: string, search?: string) {
    const people = await loadPeople(tenantId);
    const q = search?.trim().toLowerCase();
    return teamOf(me(people, userId), people)
      .filter((p) => !q || `${p.name} ${p.roleName} ${p.departmentName ?? ''}`.toLowerCase().includes(q))
      .slice(0, 300)
      .map(brief);
  }

  async create(tenantId: string, userId: string, input: CreateTaskInput) {
    const people = await loadPeople(tenantId);
    const assigner = me(people, userId);
    const targets = [...new Set(input.assigneeIds)].map((id) => {
      const t = people.find((p) => p.userId === id);
      if (!t) throw new ApiError('ASSIGNEE_NOT_FOUND', 'That person isn’t on the staff list', 400);
      if (!manages(assigner, t)) {
        throw new ApiError('NOT_YOUR_TEAM', `You can only assign work to people below you — ${t.name} isn’t`, 403);
      }
      return t;
    });
    if (!targets.length) throw new ApiError('NO_ASSIGNEE', 'Choose who should do this', 400);

    const now = new Date();
    const groupId = targets.length > 1 ? new ObjectId().toHexString() : undefined;
    const docs: TaskDoc[] = [];
    for (const t of targets) {
      const seq = await generateSequence('workTask', tenantId);
      docs.push({
        _id: new ObjectId(),
        tenantId: new ObjectId(tenantId),
        number: `TSK-${padSequence(seq, 4)}`,
        groupId,
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        priority: input.priority ?? 'medium',
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        requireReview: input.requireReview ?? true,
        status: 'todo',
        progress: 0,
        checklist: (input.checklist ?? []).filter((c) => c.trim()).map((text) => ({ id: new ObjectId().toHexString(), text: text.trim(), done: false })),
        assignedBy: brief(assigner),
        assignee: brief(t),
        updates: [{ at: now, by: brief(assigner), kind: 'created', text: `Assigned to ${t.name}` }],
        createdAt: now,
        updatedAt: now,
      });
    }
    await tasks().insertMany(docs);
    return docs.map((d) => view(d, assigner, people));
  }

  /** mine: assigned to me · assigned: by me · team: anyone below me. */
  async list(tenantId: string, userId: string, scope: 'mine' | 'assigned' | 'team', status?: string) {
    const people = await loadPeople(tenantId);
    const viewer = me(people, userId);
    const filter: Record<string, unknown> = { tenantId: new ObjectId(tenantId) };
    if (scope === 'mine') filter['assignee.userId'] = userId;
    else if (scope === 'assigned') filter['assignedBy.userId'] = userId;
    else filter['assignee.userId'] = { $in: teamOf(viewer, people).map((p) => p.userId) };
    if (status) filter.status = { $in: status.split(',') };
    const rows = await tasks()
      .find(filter, { projection: { updates: 0 } })
      .sort({ updatedAt: -1 })
      .limit(500)
      .toArray();
    return rows.map((t) => view({ ...t, updates: [] }, viewer, people));
  }

  async get(tenantId: string, userId: string, id: string) {
    const people = await loadPeople(tenantId);
    const viewer = me(people, userId);
    const t = await this.load(tenantId, id);
    const assignee = people.find((p) => p.userId === t.assignee.userId);
    const allowed =
      t.assignee.userId === userId || t.assignedBy.userId === userId || (!!assignee && manages(viewer, assignee));
    if (!allowed) throw new ApiError('TASK_NOT_FOUND', 'Task not found', 404);
    return view(t, viewer, people);
  }

  private async load(tenantId: string, id: string) {
    if (!ObjectId.isValid(id)) throw new ApiError('TASK_NOT_FOUND', 'Task not found', 404);
    const t = await tasks().findOne({ _id: new ObjectId(id), tenantId: new ObjectId(tenantId) });
    if (!t) throw new ApiError('TASK_NOT_FOUND', 'Task not found', 404);
    return t;
  }

  /**
   * Every change goes through here so the rules live in one place:
   * the assignee works it (status up to review, progress, checklist,
   * comments); the assigner — or anyone above the assignee — approves,
   * reopens, edits or cancels.
   */
  async act(
    tenantId: string,
    userId: string,
    id: string,
    action:
      | { type: 'status'; status: TaskStatus; note?: string }
      | { type: 'progress'; progress: number }
      | { type: 'checklist'; itemId: string; done: boolean }
      | { type: 'comment'; text: string }
      | { type: 'edit'; title?: string; description?: string; priority?: Priority; dueDate?: string | null }
  ) {
    const people = await loadPeople(tenantId);
    const viewer = me(people, userId);
    const t = await this.load(tenantId, id);
    const v = view(t, viewer, people);
    const isParty = v.can.work || v.can.review || v.can.manage || v.can.reopen || t.assignee.userId === userId;
    if (!isParty) throw new ApiError('TASK_NOT_FOUND', 'Task not found', 404);

    const now = new Date();
    const by = brief(viewer);
    const set: Partial<TaskDoc> = { updatedAt: now };
    const update: TaskUpdate = { at: now, by, kind: action.type === 'edit' ? 'edited' : action.type };

    switch (action.type) {
      case 'comment':
        if (!action.text.trim()) throw new ApiError('EMPTY', 'Write something first', 400);
        update.text = action.text.trim();
        break;
      case 'progress':
        if (!v.can.work) throw new ApiError('NOT_ASSIGNEE', 'Only the person doing the task updates progress', 403);
        set.progress = Math.max(0, Math.min(100, Math.round(action.progress)));
        if (t.status === 'todo' && set.progress > 0) set.status = 'in_progress';
        update.to = `${set.progress}%`;
        break;
      case 'checklist': {
        if (!v.can.work && !v.can.manage) throw new ApiError('NOT_ALLOWED', 'You can’t change this checklist', 403);
        const checklist = t.checklist.map((c) => (c.id === action.itemId ? { ...c, done: action.done } : c));
        set.checklist = checklist;
        set.progress = checklist.length ? Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100) : t.progress;
        if (t.status === 'todo') set.status = 'in_progress';
        update.text = checklist.find((c) => c.id === action.itemId)?.text;
        update.to = action.done ? 'done' : 'not done';
        break;
      }
      case 'edit':
        if (!v.can.manage) throw new ApiError('NOT_ALLOWED', 'Only the assigner or a lead above can edit this', 403);
        if (action.title?.trim()) set.title = action.title.trim();
        if (action.description !== undefined) set.description = action.description.trim() || undefined;
        if (action.priority) set.priority = action.priority;
        if (action.dueDate !== undefined) set.dueDate = action.dueDate ? new Date(action.dueDate) : undefined;
        break;
      case 'status': {
        const to = action.status;
        const from = t.status;
        const assigneeMoves: Record<string, TaskStatus[]> = { todo: ['in_progress', 'in_review', 'done'], in_progress: ['todo', 'in_review', 'done'] };
        if (v.can.work && assigneeMoves[from]?.includes(to)) {
          // A finished task goes to review first when the assigner asked for it.
          set.status = (to === 'done' || to === 'in_review') && t.requireReview ? 'in_review' : to;
        } else if (v.can.review && (to === 'done' || to === 'in_progress')) {
          set.status = to; // approve, or send back
        } else if (v.can.reopen && to === 'in_progress') {
          set.status = 'in_progress';
        } else if (v.can.manage && to === 'cancelled') {
          set.status = 'cancelled';
        } else {
          throw new ApiError('NOT_ALLOWED', 'That change isn’t available to you on this task', 403);
        }
        if (set.status === 'done') {
          set.completedAt = now;
          set.progress = 100;
        }
        update.from = from;
        update.to = set.status;
        update.text = action.note?.trim() || undefined;
        break;
      }
    }
    await tasks().updateOne({ _id: t._id }, { $set: set, $push: { updates: update } });
    return this.get(tenantId, userId, id);
  }

  /** Counts for the bell and the page header. */
  async summary(tenantId: string, userId: string) {
    const t = new ObjectId(tenantId);
    const open = { $in: ['todo', 'in_progress', 'in_review'] as TaskStatus[] };
    const now = new Date();
    const [mine, overdue, toReview] = await Promise.all([
      tasks().countDocuments({ tenantId: t, 'assignee.userId': userId, status: { $in: ['todo', 'in_progress'] } }),
      tasks().countDocuments({ tenantId: t, 'assignee.userId': userId, status: open, dueDate: { $lt: now } }),
      tasks().countDocuments({ tenantId: t, 'assignedBy.userId': userId, status: 'in_review' }),
    ]);
    return { mine, overdue, toReview };
  }
}

export const tasksService = new TasksService();
