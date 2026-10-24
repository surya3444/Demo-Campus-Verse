import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { success, created } from '../../utils/response';
import { tasksService } from './tasks.service';
import { issuesService } from './issues.service';

/**
 * My Workspace: tasks handed down the hierarchy and issues raised up it.
 * Not branch-scoped — a branch admin assigns across their branch, the org
 * admin across all of them — so who-can-reach-whom lives in hierarchy.ts.
 */
const router = Router();
router.use(authenticate);

type Handler = (req: Request) => Promise<unknown>;
const h =
  (fn: Handler, status: 'ok' | 'created' = 'ok') =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await fn(req);
      if (status === 'created') created(res, data);
      else success(res, data);
    } catch (e) {
      next(e);
    }
  };
const who = (req: Request) => [req.tenantId!, req.user!.userId] as const;
const id = (req: Request) => req.params.id as string;
const q = (req: Request, k: string) => req.query[k] as string | undefined;

const priority = z.enum(['low', 'medium', 'high', 'urgent']);
const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(5000).optional(),
  priority: priority.optional(),
  dueDate: z.string().optional().describe('ISO date the work is due'),
  requireReview: z.boolean().optional().describe('Assigner approves before it counts as done (default true)'),
  checklist: z.array(z.string().max(300)).max(30).optional(),
  assigneeIds: z.array(z.string()).min(1).max(100).describe('userIds from GET /workspace/tasks/assignable'),
});
const taskActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']), note: z.string().max(2000).optional() }),
  z.object({ type: z.literal('progress'), progress: z.number().min(0).max(100) }),
  z.object({ type: z.literal('checklist'), itemId: z.string(), done: z.boolean() }),
  z.object({ type: z.literal('comment'), text: z.string().min(1).max(4000) }),
  z.object({
    type: z.literal('edit'),
    title: z.string().max(200).optional(),
    description: z.string().max(5000).optional(),
    priority: priority.optional(),
    dueDate: z.string().nullable().optional(),
  }),
]);

const raiseIssueSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(5000),
  category: z.enum(['academic', 'infrastructure', 'it', 'hr', 'finance', 'students', 'safety', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  toUserId: z.string().optional().describe('Skip ahead to someone further up (from GET /workspace/issues/route)'),
});
const note = z.string().max(2000).optional();
const issueActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('comment'), text: z.string().min(1).max(4000) }),
  z.object({ type: z.literal('acknowledge') }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('resolve'), resolution: z.string().min(3).max(4000) }),
  z.object({ type: z.literal('escalate'), note }),
  z.object({ type: z.literal('delegate'), toUserId: z.string(), note }),
  z.object({ type: z.literal('take_over') }),
  z.object({ type: z.literal('close') }),
  z.object({ type: z.literal('reopen'), note }),
]);

const tasksView = requirePermission('workspace.tasks', 'view');
const issuesView = requirePermission('workspace.issues', 'view');

router.get(
  '/summary',
  h(async (req) => {
    const [tasks, issues] = await Promise.all([tasksService.summary(...who(req)), issuesService.summary(...who(req))]);
    return { tasks, issues };
  })
);

// Tasks
router.get('/tasks', tasksView, h((req) => tasksService.list(...who(req), (q(req, 'scope') as 'mine' | 'assigned' | 'team') ?? 'mine', q(req, 'status'))));
router.get('/tasks/assignable', requirePermission('workspace.tasks', 'assign'), h((req) => tasksService.assignable(...who(req), q(req, 'search'))));
router.post('/tasks', requirePermission('workspace.tasks', 'assign'), validateBody(createTaskSchema), h((req) => tasksService.create(...who(req), req.body), 'created'));
router.get('/tasks/:id', tasksView, h((req) => tasksService.get(...who(req), id(req))));
router.post('/tasks/:id/actions', tasksView, validateBody(taskActionSchema), h((req) => tasksService.act(...who(req), id(req), req.body)));

// Issues
router.get('/issues', issuesView, h((req) => issuesService.list(...who(req), (q(req, 'scope') as 'raised' | 'assigned' | 'team') ?? 'raised', q(req, 'status'))));
router.get('/issues/route', requirePermission('workspace.issues', 'raise'), h((req) => issuesService.route(...who(req))));
router.post('/issues', requirePermission('workspace.issues', 'raise'), validateBody(raiseIssueSchema), h((req) => issuesService.raise(...who(req), req.body), 'created'));
router.get('/issues/:id', issuesView, h((req) => issuesService.get(...who(req), id(req))));
router.post('/issues/:id/actions', issuesView, validateBody(issueActionSchema), h((req) => issuesService.act(...who(req), id(req), req.body)));

export default router;
