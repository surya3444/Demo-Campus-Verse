import { BaseEntity } from './common';

// ============ Course Types ============

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseVisibility = 'branch' | 'selected_branches' | 'all';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseCategory =
  | 'technical'
  | 'soft_skills'
  | 'aptitude'
  | 'language'
  | 'domain_specific'
  | 'certification_prep'
  | 'career_readiness'
  | 'general';

export interface CourseModule {
  _id: string;
  title: string;
  description?: string;
  duration?: number;
  order: number;
  resources?: string[];
}

/**
 * Course - Online teaching course
 */
export interface Course extends BaseEntity {
  courseNumber: string;
  title: string;
  description: string;
  category: CourseCategory;
  level: CourseLevel;
  duration?: number;
  tags?: string[];
  instructor?: string;
  instructorId?: string;
  instructorName?: string;
  modules: CourseModule[];
  thumbnailUrl?: string;
  introVideoUrl?: string;
  status: CourseStatus;
  visibility: CourseVisibility;
  visibleBranchIds?: string[];
  branchId: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdBy: string;
}

// ============ Lesson Types ============

export type LessonType = 'video' | 'document' | 'live';
export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

/**
 * Lesson - A video/document/live content unit within a course module
 */
export interface Lesson extends BaseEntity {
  courseId: string;
  moduleId: string;
  title: string;
  description?: string;
  type: LessonType;
  contentUrl?: string;
  duration?: number;
  order: number;
  isPreview: boolean;
  branchId: string;
  createdBy: string;
}

// ============ Quiz Types ============

export type QuizQuestionType = 'mcq' | 'true_false' | 'short_answer';

export interface QuizQuestion {
  _id: string;
  questionText: string;
  type: QuizQuestionType;
  options?: string[];
  correctAnswer: string;
  points: number;
}

/**
 * Quiz - Assessment tied to a course or module
 */
export interface Quiz extends BaseEntity {
  courseId: string;
  moduleId?: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimitMinutes?: number;
  maxAttempts: number;
  branchId: string;
  createdBy: string;
}

// ============ Enrollment Types ============

export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'dropped';

/**
 * CourseEnrollment - Student enrollment in a course
 */
export interface CourseEnrollment extends BaseEntity {
  courseId: string;
  studentId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  completedAt?: Date;
  completionPercentage: number;
  certificateIssued: boolean;
  branchId: string;
}

// ============ Progress Types ============

/**
 * LessonProgress - Tracks per-lesson completion for a student
 */
export interface LessonProgress extends BaseEntity {
  enrollmentId: string;
  lessonId: string;
  courseId: string;
  studentId: string;
  status: LessonStatus;
  watchedDuration?: number;
  completedAt?: Date;
}

// ============ Quiz Attempt Types ============

export interface QuizAnswer {
  questionId: string;
  answer: string;
}

/**
 * QuizAttempt - Student quiz submission
 */
export interface QuizAttempt extends BaseEntity {
  quizId: string;
  courseId: string;
  studentId: string;
  enrollmentId: string;
  answers: QuizAnswer[];
  score: number;
  totalPoints: number;
  passed: boolean;
  startedAt: Date;
  submittedAt: Date;
}

// ============ Course Settings Types ============

/**
 * CourseSettings - Branch-level configuration for the courses module
 */
export interface CourseSettings extends BaseEntity {
  branchId: string;
  allowSelfEnrollment: boolean;
  requireApprovalForPublish: boolean;
  maxEnrollmentsPerCourse?: number;
  certificateAutoIssue: boolean;
}
