import { BaseEntity } from './common';

// ============ Enums / Literal Types ============

export type TimetableSlotType = 'period' | 'break' | 'assembly' | 'lunch';
export type LessonPlanStatus = 'draft' | 'published' | 'completed';
export type TeachingStatus =
  | 'not_started'
  | 'ongoing'
  | 'delivered'
  | 'questionnaire_sent'
  | 'all_submitted'
  | 'completed_with_assignment'
  | 'completed';
export type AssignmentStatus = 'draft' | 'published' | 'grading' | 'completed';

// ============ Main Entities ============

/**
 * TimetableSlot - Period/break definition for a branch
 */
export interface TimetableSlot extends BaseEntity {
  branchId: string;
  sectionId?: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  order: number;
  type: TimetableSlotType;
}

/**
 * TimetableEntry - Maps a teacher to a section/subject in a specific slot and day
 */
export interface TimetableEntry extends BaseEntity {
  branchId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  slotId: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  /** Lab slot for a subset of the section (id from Section.batches). */
  batchId?: string;
  roomNumber?: string;
  notes?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  teacherName?: string;
}

/**
 * TeachingAssignment — the canonical, section-granular record of who teaches
 * which subject to which section. Replaces the class-granular
 * staff.teaching.subjects (kept as a denormalized summary during migration,
 * retired in Phase 5). Cross-department teaching is explicit and validated:
 * the section may belong to a different department than the teacher's home,
 * but the subject's sharing rules must allow it.
 */
export interface TeachingAssignment extends BaseEntity {
  /** Branch of the SECTION being taught (may differ from the teacher's home branch). */
  branchId: string;
  academicBatchId: string;
  termId?: string;
  staffId: string;
  subjectId: string;
  sectionId: string;
  /** Optional lab-batch restriction (ids from Section.batches). */
  batchIds?: string[];
  role: 'primary' | 'assistant' | 'lab';
  status: 'active' | 'ended';
}

/**
 * LessonPlan - Teacher's planned lesson for a class
 */
export interface LessonPlan extends BaseEntity {
  branchId: string;
  sectionId: string;
  subjectId: string;
  slotId?: string;
  teacherId: string;
  title: string;
  date: Date;
  description?: string;
  objectives?: string[];
  topics?: string[];
  resources?: string[];
  methodology?: string;
  assessment?: string;
  duration?: number;
  notes?: string;
  attachments?: string[];
  status: LessonPlanStatus;
  teachingStatus: TeachingStatus;
  linkedAssignmentId?: string;
  teacherName?: string;
  sectionName?: string;
  slotName?: string;
  slotStartTime?: string;
  slotEndTime?: string;
  subjectName?: string;
}

/**
 * Assignment - Teacher-created assignment for a section
 */
export type AssignmentType = 'homework' | 'classwork' | 'project' | 'test' | 'quiz' | 'other';

export interface Assignment extends BaseEntity {
  branchId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description?: string;
  instructions?: string;
  type: AssignmentType;
  totalMarks: number;
  dueDate?: Date;
  assignedDate: Date;
  status: AssignmentStatus;
  publishedAt?: Date;
  completedAt?: Date;
  attachments?: string[];
  notes?: string;
  teacherName?: string;
  sectionName?: string;
  subjectName?: string;
}

/**
 * Grade - Student's marks for an assignment
 */
export interface Grade extends BaseEntity {
  branchId: string;
  assignmentId: string;
  studentId: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  remarks?: string;
  gradedBy: string;
  gradedAt: Date;
  admissionNumber?: string;
  studentName?: string;
  assignmentTitle?: string;
}

export type QuestionType = 'mcq' | 'short_answer' | 'true_false';
export type QuestionnaireStatus = 'draft' | 'published' | 'closed';

/**
 * Questionnaire - Linked to a lesson plan, contains questions for students
 */
export interface Questionnaire extends BaseEntity {
  branchId: string;
  lessonPlanId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  questions: {
    _id: string;
    type: QuestionType;
    question: string;
    options?: string[];
    correctAnswer: string;
    marks: number;
  }[];
  totalMarks: number;
  dueDate?: Date;
  status: QuestionnaireStatus;
  lessonTitle?: string;
  sectionName?: string;
  subjectName?: string;
}

/**
 * QuestionnaireSubmission - Student's answers to a questionnaire
 */
export interface QuestionnaireSubmission extends BaseEntity {
  branchId: string;
  questionnaireId: string;
  studentId: string;
  answers: { questionId: string; answer: string }[];
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: Date;
  studentName?: string;
}

// ============ View Types ============

/**
 * TeacherSection - Read-only view for My Classes
 */
export interface TeacherSection {
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  subjectIds: string[];
  subjectNames: string[];
  studentCount: number;
  isClassTeacher: boolean;
  averageAttendance: number | null;
  source: 'class_teacher' | 'teaching_assignment' | 'timetable';
}

/**
 * TeacherTimetableView - Read-only view for timetable display
 */
export interface TeacherTimetableView {
  dayOfWeek: number;
  slotName: string;
  startTime: string;
  endTime: string;
  sectionName: string;
  subjectName: string;
  slotType: TimetableSlotType;
}
