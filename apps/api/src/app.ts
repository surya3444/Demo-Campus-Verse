import express, { Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimit';
import { env } from './config/env';

// Routes
import authRoutes from './modules/auth/auth.routes';
import adminRoutes from './modules/admin/admin.routes';
import organizationRoutes from './modules/organization/organization.routes';
import studentRoutes from './modules/student/student.routes';
import admissionRoutes from './modules/admission/admission.routes';
import financeRoutes from './modules/finance/finance.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import hrRoutes from './modules/hr/hr.routes';
import communicationRoutes from './modules/communication/communication.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import searchRoutes from './modules/search/search.routes';
import certificateRoutes from './modules/certificates/certificate.routes';
import schedulerRoutes from './modules/scheduler/scheduler.routes';
import uploadRoutes from './modules/upload/upload.routes';
import healthRoutes from './modules/health/health.routes';
import teachingRoutes from './modules/teaching/teaching.routes';
import liveClassWebhookRoutes from './modules/teaching/liveClass.webhook';
import razorpayWebhookRoutes from './modules/finance/razorpayWebhook';
import razorpayXWebhookRoutes from './modules/hr/razorpayXWebhook';
import careerConnectRoutes from './modules/career-connect/career-connect.routes';
import hostelRoutes from './modules/hostel/hostel.routes';
import coursesRoutes from './modules/courses/courses.routes';
import feedRoutes from './modules/feed/feed.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import expenseRoutes from './modules/expense/expense.routes';
import visitorRoutes from './modules/visitor/visitor.routes';
import feedbackRoutes from './modules/feedback/feedback.routes';
import transportRoutes from './modules/transport/transport.routes';
import marketingLeadsRoutes from './modules/marketing-leads/marketing-leads.routes';
import blogRoutes from './modules/blog/blog.routes';
import careersRoutes from './modules/careers/careers.routes';
import examsRoutes from './modules/exams/exams.routes';
import registrationRoutes from './modules/registration/registration.routes';
import obeRoutes from './modules/obe/obe.routes';
import aiRoutes from './modules/ai/ai.routes';
import auditRoutes from './modules/audit/audit.routes';
import centralRoutes from './modules/central/central.routes';
import { auditLog } from './middleware/auditLog';

const app: ReturnType<typeof express> = express();

// Security
app.use(helmet());

// Parse allowed origins from APP_URL (comma-separated)
const allowedOrigins = env.APP_URL.split(',').map((url) => url.trim());

// Public, browser-facing marketing endpoints: blog reads, vacancy listings, and
// anonymous job applications. These are consumed cross-origin by the public
// website (and local dev of it), so they must accept any origin. The matching
// /admin sub-routes are explicitly excluded and stay on the strict allow-list.
const isPublicMarketingPath = (path: string): boolean => {
  if (path.startsWith('/api/v1/careers/admin') || path.startsWith('/api/v1/blog/admin')) {
    return false;
  }
  return (
    path.startsWith('/api/v1/careers/vacancies') ||
    path === '/api/v1/careers/applications' ||
    path.startsWith('/api/v1/blog/posts')
  );
};

app.use(
  // Per-request CORS: open for public marketing endpoints, strict everywhere else.
  // The cors delegate types `req` as a minimal CorsRequest; at runtime it is the
  // full Express request, so we cast to read the path.
  cors((req, callback) => {
    if (isPublicMarketingPath((req as unknown as Request).path)) {
      // Anonymous, no cookies — reflect any origin, no credentials.
      return callback(null, { origin: true, credentials: false });
    }
    callback(null, {
      origin: (origin, cb) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return cb(null, true);
        // In development, allow localhost on any port
        if (env.NODE_ENV === 'development' && origin?.includes('localhost')) {
          return cb(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
    });
  })
);

// LiveKit webhook needs the *raw* request body for signature verification, so it
// must be mounted BEFORE the global JSON parser swallows the payload.
app.use('/api/v1/teaching/live-classes', liveClassWebhookRoutes);

// Razorpay webhook — same constraint, raw body required for HMAC verification.
app.use('/api', razorpayWebhookRoutes);

// RazorpayX (payouts) webhook — per-branch signature, raw body required.
app.use('/api', razorpayXWebhookRoutes);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  })
);

// Rate limiting
app.use('/api', apiRateLimiter);

// Activity / audit trail — records every authenticated mutation (runs on response
// finish, after each route's auth middleware has populated req.user/tenant/branch).
app.use('/api', auditLog);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/organization', organizationRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/admissions', admissionRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/communications', communicationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/scheduler', schedulerRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/teaching', teachingRoutes);
app.use('/api/v1/career-connect', careerConnectRoutes);
app.use('/api/v1/hostel', hostelRoutes);
app.use('/api/v1/courses', coursesRoutes);
app.use('/api/v1/feed', feedRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/visitors', visitorRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/transport', transportRoutes);
app.use('/api/v1/marketing-leads', marketingLeadsRoutes);
app.use('/api/v1/blog', blogRoutes);
app.use('/api/v1/careers', careersRoutes);
app.use('/api/v1/exams', examsRoutes);
app.use('/api/v1/registration', registrationRoutes);
app.use('/api/v1/obe', obeRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/audit', auditRoutes);
// Cross-institution ("All institutions") rollups — deliberately branch-less.
app.use('/api/v1/central', centralRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

export { app };
