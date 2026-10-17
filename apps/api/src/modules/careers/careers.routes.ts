import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateSuperAdmin } from '../../middleware/superAdminAuth';
import { requireS3Configured } from '../upload/upload.middleware';
import { blogImageUpload } from '../blog/blog.upload';
import { resumeUpload } from './careers.upload';
import { careersController } from './careers.controller';

const router: ReturnType<typeof Router> = Router();

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many applications from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============ Public ============
router.get('/vacancies', careersController.listPublishedVacancies);
router.get('/vacancies/:slug', careersController.getVacancyBySlug);
router.post(
  '/applications',
  applyLimiter,
  requireS3Configured,
  resumeUpload('resume'),
  careersController.submitApplication
);

// ============ Admin (Super Admin only) ============
router.use('/admin', authenticateSuperAdmin);

// Reuse the blog image uploader for JD inline images (same `blog/` prefix is fine).
router.post('/admin/upload', requireS3Configured, blogImageUpload('file'), (req, res, next) => {
  try {
    const file = req.file as
      | (Express.Multer.File & { location?: string; key?: string })
      | undefined;
    if (!file) return next(new Error('No file'));
    res.status(201).json({ success: true, data: { url: file.location, key: file.key } });
  } catch (e) {
    next(e);
  }
});

// Vacancies (admin)
router.get('/admin/vacancies', careersController.listVacancies);
router.post('/admin/vacancies', careersController.createVacancy);
router.get('/admin/vacancies/:id', careersController.getVacancy);
router.put('/admin/vacancies/:id', careersController.updateVacancy);
router.patch('/admin/vacancies/:id/status', careersController.setVacancyStatus);
router.delete('/admin/vacancies/:id', careersController.removeVacancy);

// Applications (admin)
router.get('/admin/applications', careersController.listApplications);
router.get('/admin/applications/:id', careersController.getApplication);
router.patch('/admin/applications/:id/status', careersController.updateApplicationStatus);
router.delete('/admin/applications/:id', careersController.removeApplication);

export default router;
