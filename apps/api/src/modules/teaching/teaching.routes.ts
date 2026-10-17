import { Router } from 'express';
import { studentParamGuard } from './scope';
import { authenticate } from '../../middleware/auth';
import { requireAnyPermission, requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import { myClassesController } from './myClasses.controller';
import { teachingAssignmentController } from './teachingAssignment.controller';
import { timetableController } from './timetable.controller';
import { lessonPlanController } from './lessonPlan.controller';
import { assignmentController } from './assignment.controller';
import { gradeController } from './grade.controller';
import { questionnaireController } from './questionnaire.controller';
import { liveClassController } from './liveClass.controller';
import {
  createLiveClassSchema,
  updateLiveClassSchema,
  kickLiveClassParticipantSchema,
  liveClassSettingsPatchSchema,
} from '@campus-verse/shared/schemas';
import {
  createTeachingAssignmentSchema,
  updateTeachingAssignmentSchema,
  createTimetableSlotSchema,
  updateTimetableSlotSchema,
  copyTimetableSlotsSchema,
  createTimetableEntrySchema,
  updateTimetableEntrySchema,
  updateTimetableGroupSchema,
  bulkCreateTimetableEntriesSchema,
  generateTimetableSchema,
  createLessonPlanSchema,
  updateLessonPlanSchema,
  updateLessonPlanTeachingStatusSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  createGradeSchema,
  bulkGradeSchema,
  createQuestionnaireSchema,
  updateQuestionnaireSchema,
  submitQuestionnaireSchema,
  submitAssignmentSchema,
} from '@campus-verse/shared/schemas';

const router: ReturnType<typeof Router> = Router();

// Apply authentication, module check, and branch check to all routes
router.use(authenticate);
router.use(requireModule('teaching'));
router.use(requireBranch);

// Every :studentId here is a student: callers only reach students in their scope.
router.param('studentId', studentParamGuard);

// ============ My Classes ============

router.get(
  '/my-classes',
  requirePermission('teaching.myClasses', 'view'),
  myClassesController.getMyClasses
);

router.get(
  '/my-classes/:sectionId/students',
  requirePermission('teaching.myStudents', 'view'),
  myClassesController.getSectionStudents
);

router.get(
  '/my-classes/:sectionId/lesson-plans',
  requirePermission('teaching.lessonPlans', 'view'),
  myClassesController.getSectionLessonPlans
);

// ============ Teaching Assignments (who teaches what, section-granular) ============
// Managed by admins/HoDs via the timetable permission; teachers can view.

router.get(
  '/teaching-assignments',
  requirePermission('teaching.timetable', 'view'),
  teachingAssignmentController.findAll
);

router.post(
  '/teaching-assignments',
  requirePermission('teaching.timetable', 'create'),
  validateBody(createTeachingAssignmentSchema),
  teachingAssignmentController.create
);

router.put(
  '/teaching-assignments/:id',
  requirePermission('teaching.timetable', 'edit'),
  validateBody(updateTeachingAssignmentSchema),
  teachingAssignmentController.update
);

router.delete(
  '/teaching-assignments/:id',
  requirePermission('teaching.timetable', 'delete'),
  teachingAssignmentController.delete
);

// ============ Timetable Slots ============

router.get(
  '/timetable/slots',
  requirePermission('teaching.timetable', 'view'),
  timetableController.getSlots
);

router.post(
  '/timetable/slots',
  requirePermission('teaching.timetable', 'create'),
  validateBody(createTimetableSlotSchema),
  timetableController.createSlot
);

router.post(
  '/timetable/slots/copy',
  requirePermission('teaching.timetable', 'create'),
  validateBody(copyTimetableSlotsSchema),
  timetableController.copySlots
);

router.put(
  '/timetable/slots/:id',
  requirePermission('teaching.timetable', 'edit'),
  validateBody(updateTimetableSlotSchema),
  timetableController.updateSlot
);

router.delete(
  '/timetable/slots/:id',
  requirePermission('teaching.timetable', 'delete'),
  timetableController.deleteSlot
);

// ============ Timetable Entries ============

// Teachers already busy at a period's time (for greying out pickers)
router.get(
  '/timetable/busy',
  requirePermission('teaching.timetable', 'view'),
  timetableController.getBusyTeachers
);

// Auto-generate a program's/department's week (preview, or apply with apply:true)
router.post(
  '/timetable/generate',
  requirePermission('teaching.timetable', 'create'),
  validateBody(generateTimetableSchema),
  timetableController.generate
);

// Empty one section's week (periods stay)
router.delete(
  '/timetable/section/:sectionId',
  requirePermission('teaching.timetable', 'delete'),
  timetableController.clearSection
);

router.get(
  '/timetable/section/:sectionId',
  requirePermission('teaching.timetable', 'view'),
  timetableController.getSectionTimetable
);

router.get(
  '/timetable/my',
  // HR reads staff weeks too (the controller still limits whose).
  requireAnyPermission([
    { module: 'teaching.timetable', action: 'view' },
    { module: 'hr.staff', action: 'view' },
  ]),
  timetableController.getMyTimetable
);

router.post(
  '/timetable/entries',
  requirePermission('teaching.timetable', 'create'),
  validateBody(createTimetableEntrySchema),
  timetableController.createEntry
);

router.post(
  '/timetable/entries/bulk',
  requirePermission('teaching.timetable', 'create'),
  validateBody(bulkCreateTimetableEntriesSchema),
  timetableController.bulkCreateEntries
);

router.put(
  '/timetable/entries/group/:groupId',
  requirePermission('teaching.timetable', 'edit'),
  validateBody(updateTimetableGroupSchema),
  timetableController.updateGroup
);

router.delete(
  '/timetable/entries/group/:groupId',
  requirePermission('teaching.timetable', 'delete'),
  timetableController.deleteGroup
);

router.put(
  '/timetable/entries/:id',
  requirePermission('teaching.timetable', 'edit'),
  validateBody(updateTimetableEntrySchema),
  timetableController.updateEntry
);

router.delete(
  '/timetable/entries/:id',
  requirePermission('teaching.timetable', 'delete'),
  timetableController.deleteEntry
);

// ============ Lesson Plans ============

router.get(
  '/lesson-plans',
  requirePermission('teaching.lessonPlans', 'view'),
  lessonPlanController.findAll
);

router.post(
  '/lesson-plans',
  requirePermission('teaching.lessonPlans', 'create'),
  validateBody(createLessonPlanSchema),
  lessonPlanController.create
);

router.get(
  '/lesson-plans/:id',
  requirePermission('teaching.lessonPlans', 'view'),
  lessonPlanController.findById
);

router.put(
  '/lesson-plans/:id',
  requirePermission('teaching.lessonPlans', 'edit'),
  validateBody(updateLessonPlanSchema),
  lessonPlanController.update
);

router.put(
  '/lesson-plans/:id/teaching-status',
  requirePermission('teaching.lessonPlans', 'edit'),
  validateBody(updateLessonPlanTeachingStatusSchema),
  lessonPlanController.updateTeachingStatus
);

router.delete(
  '/lesson-plans/:id',
  requirePermission('teaching.lessonPlans', 'delete'),
  lessonPlanController.delete
);

// ============ Assignments ============

router.get(
  '/assignments',
  requirePermission('teaching.assignments', 'view'),
  assignmentController.findAll
);

router.post(
  '/assignments',
  requirePermission('teaching.assignments', 'create'),
  validateBody(createAssignmentSchema),
  assignmentController.create
);

router.get(
  '/assignments/:id',
  requirePermission('teaching.assignments', 'view'),
  assignmentController.findById
);

router.put(
  '/assignments/:id',
  requirePermission('teaching.assignments', 'edit'),
  validateBody(updateAssignmentSchema),
  assignmentController.update
);

router.delete(
  '/assignments/:id',
  requirePermission('teaching.assignments', 'delete'),
  assignmentController.delete
);

router.put(
  '/assignments/:id/publish',
  requirePermission('teaching.assignments', 'edit'),
  assignmentController.publish
);

router.put(
  '/assignments/:id/start-grading',
  requirePermission('teaching.assignments', 'edit'),
  assignmentController.startGrading
);

router.put(
  '/assignments/:id/complete',
  requirePermission('teaching.assignments', 'edit'),
  assignmentController.complete
);

router.post(
  '/assignments/:id/submit',
  requirePermission('teaching.assignments', 'view'),
  validateBody(submitAssignmentSchema),
  assignmentController.submitAnswers
);

router.get(
  '/assignments/:id/submissions',
  requirePermission('teaching.assignments', 'view'),
  assignmentController.getSubmissions
);

router.get(
  '/assignments/:id/my-submission',
  requirePermission('teaching.assignments', 'view'),
  assignmentController.getMySubmission
);

router.put(
  '/assignments/:id/submissions/:submissionId/review',
  requirePermission('teaching.assignments', 'edit'),
  assignmentController.reviewSubmission
);

// ============ Grades ============

router.get(
  '/grades/assignment/:assignmentId',
  requirePermission('teaching.grades', 'view'),
  gradeController.getGradesForAssignment
);

router.get(
  '/grades/student/:studentId',
  requirePermission('teaching.grades', 'view'),
  gradeController.getStudentGrades
);

router.get(
  '/grades/section-report',
  requirePermission('teaching.grades', 'view'),
  gradeController.getSectionReport
);

router.get(
  '/grades/section-students',
  requirePermission('teaching.grades', 'view'),
  gradeController.getSectionStudentGrades
);

router.post(
  '/grades',
  requirePermission('teaching.grades', 'create'),
  validateBody(createGradeSchema),
  gradeController.gradeStudent
);

router.post(
  '/grades/bulk',
  requirePermission('teaching.grades', 'create'),
  validateBody(bulkGradeSchema),
  gradeController.bulkGrade
);

// ============ Questionnaires ============

router.get(
  '/questionnaires',
  requirePermission('teaching.lessonPlans', 'view'),
  questionnaireController.findAll
);

router.post(
  '/questionnaires',
  requirePermission('teaching.lessonPlans', 'create'),
  validateBody(createQuestionnaireSchema),
  questionnaireController.create
);

router.get(
  '/questionnaires/lesson/:lessonPlanId',
  requirePermission('teaching.lessonPlans', 'view'),
  questionnaireController.findByLessonPlan
);

router.get(
  '/questionnaires/:id',
  requirePermission('teaching.lessonPlans', 'view'),
  questionnaireController.findById
);

router.put(
  '/questionnaires/:id',
  requirePermission('teaching.lessonPlans', 'edit'),
  validateBody(updateQuestionnaireSchema),
  questionnaireController.update
);

router.post(
  '/questionnaires/:id/publish',
  requirePermission('teaching.lessonPlans', 'edit'),
  questionnaireController.publish
);

router.post(
  '/questionnaires/:id/submit',
  requirePermission('teaching.lessonPlans', 'view'),
  validateBody(submitQuestionnaireSchema),
  questionnaireController.submit
);

router.get(
  '/questionnaires/:id/submissions',
  requirePermission('teaching.lessonPlans', 'view'),
  questionnaireController.getSubmissions
);

router.get(
  '/questionnaires/:id/my-submission',
  requirePermission('teaching.lessonPlans', 'view'),
  questionnaireController.getMySubmission
);

router.put(
  '/questionnaires/:id/submissions/:submissionId/review',
  requirePermission('teaching.lessonPlans', 'edit'),
  questionnaireController.reviewSubmission
);

router.delete(
  '/questionnaires/:id',
  requirePermission('teaching.lessonPlans', 'delete'),
  questionnaireController.delete
);

// ============ Live Classes ============

router.get(
  '/live-classes',
  requirePermission('teaching.liveClasses', 'view'),
  liveClassController.list
);

router.post(
  '/live-classes',
  requirePermission('teaching.liveClasses', 'create'),
  validateBody(createLiveClassSchema),
  liveClassController.create
);

router.get(
  '/live-classes/:id',
  requirePermission('teaching.liveClasses', 'view'),
  liveClassController.getById
);

router.patch(
  '/live-classes/:id',
  requirePermission('teaching.liveClasses', 'edit'),
  validateBody(updateLiveClassSchema),
  liveClassController.update
);

router.post(
  '/live-classes/:id/start',
  requirePermission('teaching.liveClasses', 'edit'),
  liveClassController.start
);

router.post(
  '/live-classes/:id/end',
  requirePermission('teaching.liveClasses', 'edit'),
  liveClassController.end
);

router.post(
  '/live-classes/:id/cancel',
  requirePermission('teaching.liveClasses', 'edit'),
  liveClassController.cancel
);

router.post(
  '/live-classes/:id/join',
  requirePermission('teaching.liveClasses', 'view'),
  liveClassController.join
);

router.get(
  '/live-classes/:id/messages',
  requirePermission('teaching.liveClasses', 'view'),
  liveClassController.listMessages
);

router.get(
  '/live-classes/:id/polls',
  requirePermission('teaching.liveClasses', 'view'),
  liveClassController.listPolls
);

router.get(
  '/live-classes/:id/participants',
  requirePermission('teaching.liveClasses', 'view'),
  liveClassController.listParticipants
);

// Host controls — only available while a class is live. Service enforces
// host/cohost ownership; admins (roleLevel<=3) bypass.
router.post(
  '/live-classes/:id/kick',
  requirePermission('teaching.liveClasses', 'edit'),
  validateBody(kickLiveClassParticipantSchema),
  liveClassController.kick
);

router.post(
  '/live-classes/:id/mute-all',
  requirePermission('teaching.liveClasses', 'edit'),
  liveClassController.muteAll
);

router.patch(
  '/live-classes/:id/settings',
  requirePermission('teaching.liveClasses', 'edit'),
  validateBody(liveClassSettingsPatchSchema),
  liveClassController.updateLiveSettings
);

router.post(
  '/live-classes/:id/recording/start',
  requirePermission('teaching.liveClasses', 'edit'),
  liveClassController.startRecording
);

router.post(
  '/live-classes/:id/recording/stop',
  requirePermission('teaching.liveClasses', 'edit'),
  liveClassController.stopRecording
);

export default router;
