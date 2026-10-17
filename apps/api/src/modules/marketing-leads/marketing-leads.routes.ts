import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateSuperAdmin } from '../../middleware/superAdminAuth';
import { marketingLeadsController } from './marketing-leads.controller';

const router: ReturnType<typeof Router> = Router();

// Stricter rate limit for the public submission endpoint to deter abuse.
const demoRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many demo requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============ Public ============
router.post('/demo-request', demoRequestLimiter, marketingLeadsController.createDemoLead);

// ============ Admin (Super Admin only) ============
router.use('/admin', authenticateSuperAdmin);

// Pipeline (stage configuration) — declared BEFORE :id routes so the literal
// "pipeline" segment isn't swallowed by /admin/:id.
router.get('/admin/pipeline', marketingLeadsController.getPipeline);
router.post('/admin/pipeline/stages', marketingLeadsController.addStage);
router.patch('/admin/pipeline/stages/:key', marketingLeadsController.updateStage_pipeline);
router.delete('/admin/pipeline/stages/:key', marketingLeadsController.deleteStage);
router.put('/admin/pipeline/order', marketingLeadsController.reorderStages);

// Leads
router.get('/admin', marketingLeadsController.listLeads);
router.get('/admin/stats', marketingLeadsController.getStats);
router.get('/admin/:id', marketingLeadsController.getLead);
router.patch('/admin/:id/stage', marketingLeadsController.updateStage);
router.post('/admin/:id/notes', marketingLeadsController.addNote);
router.delete('/admin/:id', marketingLeadsController.deleteLead);

export default router;
