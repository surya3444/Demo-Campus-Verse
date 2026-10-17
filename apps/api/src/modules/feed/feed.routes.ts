import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { feedController } from './feed.controller';
import {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  flagPostSchema,
} from '@campus-verse/shared';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(requireBranch);

// ============ Posts ============
// Flagged posts must be before :id to avoid param conflict
router.get('/posts/flagged', feedController.getFlaggedPosts);

router.get('/posts', feedController.getPosts);

router.post('/posts', validateBody(createPostSchema), feedController.createPost);

router.get('/posts/:id', feedController.getPostById);

router.put('/posts/:id', validateBody(updatePostSchema), feedController.updatePost);

router.delete('/posts/:id', feedController.deletePost);

// ============ Likes ============
router.post('/posts/:id/like', feedController.toggleLike);

// ============ Comments ============
router.post('/posts/:id/comments', validateBody(createCommentSchema), feedController.addComment);

router.delete('/posts/:id/comments/:commentId', feedController.deleteComment);

// ============ Moderation (admin-only enforced in controller) ============
router.put('/posts/:id/pin', feedController.togglePin);

router.post('/posts/:id/flag', validateBody(flagPostSchema), feedController.flagPost);

router.delete('/posts/:id/moderate', feedController.moderateDelete);

export default router;
