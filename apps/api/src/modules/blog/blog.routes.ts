import { Router } from 'express';
import { authenticateSuperAdmin } from '../../middleware/superAdminAuth';
import { requireS3Configured } from '../upload/upload.middleware';
import { blogImageUpload } from './blog.upload';
import { blogController } from './blog.controller';

const router: ReturnType<typeof Router> = Router();

// ============ Public ============
router.get('/posts', blogController.listPublished);
router.get('/posts/:slug', blogController.getBySlug);

// ============ Admin (Super Admin only) ============
router.use('/admin', authenticateSuperAdmin);

// Image upload (cover + inline images) — declared before /:id routes.
router.post(
  '/admin/upload',
  requireS3Configured,
  blogImageUpload('file'),
  blogController.uploadImage
);

router.get('/admin', blogController.listAll);
router.post('/admin', blogController.create);
router.put('/admin/reorder', blogController.reorder);
router.get('/admin/:id', blogController.getById);
router.put('/admin/:id', blogController.update);
router.patch('/admin/:id/status', blogController.setStatus);
router.delete('/admin/:id', blogController.remove);

export default router;
