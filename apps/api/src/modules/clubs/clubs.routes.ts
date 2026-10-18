import { Router, type Request, type Response, type NextFunction } from 'express';
import { addClubMembersSchema, saveClubSchema } from '@campus-verse/shared/schemas';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { success, created } from '../../utils/response';
import { clubsService } from './clubs.service';

const router = Router();
router.use(authenticate);
router.use(requireBranch);

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
const ctx = (req: Request) => [req.tenantId!, req.branchId!] as const;
// Clubs are run like campus events: whoever may create calendar events manages clubs.
const manage = (action: 'create' | 'edit') => requirePermission('communications.calendar', action);

// Anyone signed in on the campus can browse and join.
router.get(
  '/',
  h((req) =>
    clubsService.list(...ctx(req), req.user!.userId, {
      search: req.query.search as string | undefined,
      category: req.query.category as string | undefined,
      mine: req.query.mine === 'true',
    })
  )
);
router.get(
  '/:id',
  h((req) => clubsService.get(...ctx(req), req.user!.userId, req.params.id as string))
);
router.post(
  '/:id/join',
  h((req) => clubsService.join(...ctx(req), req.user!.userId, req.params.id as string))
);
router.delete(
  '/:id/join',
  h((req) => clubsService.leave(...ctx(req), req.user!.userId, req.params.id as string))
);

router.post(
  '/',
  manage('create'),
  validateBody(saveClubSchema),
  h((req) => clubsService.create(...ctx(req), req.user!.userId, req.body), 'created')
);
router.put(
  '/:id',
  manage('edit'),
  validateBody(saveClubSchema),
  h((req) => clubsService.update(...ctx(req), req.params.id as string, req.body))
);
router.post(
  '/:id/members',
  manage('edit'),
  validateBody(addClubMembersSchema),
  h((req) => clubsService.addMembers(...ctx(req), req.params.id as string, req.body))
);

export default router;
