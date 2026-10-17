import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody, validateQuery } from '../../middleware/validate';
import { courseController } from './course.controller';
import { lessonController } from './lesson.controller';
import { quizController } from './quiz.controller';
import { enrollmentController } from './enrollment.controller';
import { progressController } from './progress.controller';
import { courseSettingsController } from './courseSettings.controller';
import {
  createCourseSchema,
  updateCourseSchema,
  courseQuerySchema,
  updateCourseVisibilitySchema,
  createLessonSchema,
  updateLessonSchema,
  lessonQuerySchema,
  createQuizSchema,
  updateQuizSchema,
  quizQuerySchema,
  enrollStudentSchema,
  updateEnrollmentSchema,
  enrollmentQuerySchema,
  updateProgressSchema,
  submitQuizAttemptSchema,
} from '@campus-verse/shared/schemas';

const router: ReturnType<typeof Router> = Router();

// Apply authentication, module check, and branch check to all routes
router.use(authenticate);
router.use(requireModule('courses'));
router.use(requireBranch);

// ============ Settings ============
// IMPORTANT: defined before /:id so the literal path wins over the param.
router.get(
  '/settings',
  requirePermission('courses.settings', 'view'),
  courseSettingsController.getSettings
);
router.put(
  '/settings',
  requirePermission('courses.settings', 'edit'),
  courseSettingsController.updateSettings
);

// ============ Courses ============

router.get(
  '/',
  requirePermission('courses.courses', 'view'),
  validateQuery(courseQuerySchema),
  courseController.list
);

router.post(
  '/',
  requirePermission('courses.courses', 'create'),
  validateBody(createCourseSchema),
  courseController.create
);

router.get(
  '/:id([0-9a-fA-F]{24})',
  requirePermission('courses.courses', 'view'),
  courseController.getById
);

router.put(
  '/:id',
  requirePermission('courses.courses', 'edit'),
  validateBody(updateCourseSchema),
  courseController.update
);

router.delete('/:id', requirePermission('courses.courses', 'delete'), courseController.delete);

router.put(
  '/:id/visibility',
  requirePermission('courses.courses', 'approve'),
  validateBody(updateCourseVisibilitySchema),
  courseController.updateVisibility
);

// ============ Lessons ============

router.get(
  '/:courseId/lessons',
  requirePermission('courses.lessons', 'view'),
  validateQuery(lessonQuerySchema),
  lessonController.list
);

router.post(
  '/:courseId/lessons',
  requirePermission('courses.lessons', 'create'),
  validateBody(createLessonSchema),
  lessonController.create
);

router.get(
  '/:courseId/lessons/:lessonId',
  requirePermission('courses.lessons', 'view'),
  lessonController.getById
);

router.put(
  '/:courseId/lessons/:lessonId([0-9a-fA-F]{24})',
  requirePermission('courses.lessons', 'edit'),
  validateBody(updateLessonSchema),
  lessonController.update
);

router.delete(
  '/:courseId/lessons/:lessonId',
  requirePermission('courses.lessons', 'delete'),
  lessonController.delete
);

router.put(
  '/:courseId/lessons/reorder',
  requirePermission('courses.lessons', 'edit'),
  lessonController.reorder
);

// ============ Quizzes ============

router.get(
  '/:courseId/quizzes',
  requirePermission('courses.quizzes', 'view'),
  validateQuery(quizQuerySchema),
  quizController.list
);

router.post(
  '/:courseId/quizzes',
  requirePermission('courses.quizzes', 'create'),
  validateBody(createQuizSchema),
  quizController.create
);

router.get(
  '/:courseId/quizzes/:quizId',
  requirePermission('courses.quizzes', 'view'),
  quizController.getById
);

router.put(
  '/:courseId/quizzes/:quizId',
  requirePermission('courses.quizzes', 'edit'),
  validateBody(updateQuizSchema),
  quizController.update
);

router.delete(
  '/:courseId/quizzes/:quizId',
  requirePermission('courses.quizzes', 'delete'),
  quizController.delete
);

// Quiz Attempts
router.post(
  '/:courseId/quizzes/:quizId/attempts',
  requirePermission('courses.quizzes', 'view'),
  validateBody(submitQuizAttemptSchema),
  quizController.submitAttempt
);

router.get(
  '/:courseId/quizzes/:quizId/attempts',
  requirePermission('courses.quizzes', 'view'),
  quizController.getAttempts
);

// ============ Enrollments ============

router.get(
  '/enrollments',
  requirePermission('courses.enrollments', 'view'),
  validateQuery(enrollmentQuerySchema),
  enrollmentController.list
);

router.post(
  '/enrollments',
  requirePermission('courses.enrollments', 'create'),
  validateBody(enrollStudentSchema),
  enrollmentController.enroll
);

router.get(
  '/enrollments/:id',
  requirePermission('courses.enrollments', 'view'),
  enrollmentController.getById
);

router.put(
  '/enrollments/:id',
  requirePermission('courses.enrollments', 'edit'),
  validateBody(updateEnrollmentSchema),
  enrollmentController.updateStatus
);

// ============ Progress ============

router.get(
  '/enrollments/:id/progress',
  requirePermission('courses.progress', 'view'),
  progressController.getCourseProgress
);

router.put(
  '/enrollments/:id/progress/:lessonId',
  requirePermission('courses.progress', 'view'),
  validateBody(updateProgressSchema),
  progressController.updateLessonProgress
);

export default router;
