import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { success } from '../../utils/response';
import { searchService } from './search.service';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

// GET /search?q=... — every group is permission- and scope-checked inside.
router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    success(res, await searchService.search(req, q));
  } catch (error) {
    next(error);
  }
});

export default router;
