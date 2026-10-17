import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';
import type {
  TimetableEntry,
  Assignment,
  PaginatedResponse,
} from '@campus-verse/mobile-shared/api/types';

// ============ Types ============

export interface StudentInfo {
  _id: string;
  name: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  sectionId: string;
  rollNumber: string;
}

export interface TodayScheduleEntry {
  slotName: string;
  startTime: string;
  endTime: string;
  slotType: 'class' | 'break' | 'assembly' | 'lunch';
  slotOrder: number;
  subjectName: string;
  teacherName: string;
}

export interface PendingAssignments {
  pending: number;
  upcoming: Array<{
    _id: string;
    title: string;
    type: 'assignment' | 'questionnaire';
    dueDate: string;
    totalMarks: number;
    hasQuestions: boolean;
  }>;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

export interface FeeSummary {
  totalDue: number;
  totalPaid: number;
  balance: number;
}

export interface HostelInfo {
  hostelName: string;
  roomNumber: string;
  bedNumber: string;
}

export interface SubmittedIds {
  assignments: string[];
  questionnaires: string[];
}

export interface Announcement {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface StudentDashboardData {
  student: StudentInfo | null;
  todaySchedule: TodayScheduleEntry[];
  assignments: PendingAssignments;
  attendance: AttendanceSummary;
  fees: FeeSummary;
  hostel: HostelInfo | null;
  announcements: Announcement[];
  submittedIds: SubmittedIds;
}

export interface StudentGrade {
  _id: string;
  studentId: string;
  assignmentId: string;
  marksObtained: number;
  totalMarks: number;
  assignmentTitle?: string;
  subjectName?: string;
  remarks?: string;
  createdAt?: string;
}

export interface QuestionAnswer {
  questionId: string;
  answer: string;
}

export interface SubmissionData {
  _id: string;
  assignmentId?: string;
  questionnaireId?: string;
  studentId: string;
  answers: QuestionAnswer[];
  submittedAt: string;
  totalMarks?: number;
  marksObtained?: number;
  isReviewed?: boolean;
  reviewedAt?: string;
  reviewerRemarks?: string;
  questionResults?: Array<{
    questionId: string;
    isCorrect: boolean;
    marksAwarded: number;
  }>;
}

export interface QuestionItem {
  _id: string;
  questionText: string;
  questionType: 'mcq' | 'true_false' | 'short_answer';
  options?: string[];
  correctAnswer?: string;
  marks: number;
}

export interface AssignmentDetail extends Omit<Assignment, 'description'> {
  description?: string;
  hasQuestions?: boolean;
  questions?: QuestionItem[];
}

export interface QuestionnaireDetail {
  _id: string;
  title: string;
  description?: string;
  sectionId: string;
  sectionName?: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  lessonPlanId?: string;
  totalMarks: number;
  dueDate?: string;
  status: string;
  questions: QuestionItem[];
  createdAt: string;
  updatedAt: string;
}

// ============ API ============

export const studentApi = {
  // Dashboard
  getStudentDashboard: async (): Promise<StudentDashboardData> => {
    return fetchApi(apiClient.get('/dashboard/student'));
  },

  // Timetable
  getSectionTimetable: async (sectionId: string): Promise<TimetableEntry[]> => {
    return fetchApi(apiClient.get(`/teaching/timetable/section/${sectionId}`));
  },

  // Assignments
  getAssignments: async (params: {
    sectionId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Assignment>> => {
    const response = await apiClient.get('/teaching/assignments', { params });
    return response.data;
  },

  getAssignment: async (id: string): Promise<AssignmentDetail> => {
    return fetchApi(apiClient.get(`/teaching/assignments/${id}`));
  },

  submitAssignment: async (
    id: string,
    data: { answers: QuestionAnswer[]; studentId?: string }
  ): Promise<SubmissionData> => {
    return fetchApi(apiClient.post(`/teaching/assignments/${id}/submit`, data));
  },

  getMyAssignmentSubmission: async (id: string): Promise<SubmissionData> => {
    return fetchApi(apiClient.get(`/teaching/assignments/${id}/my-submission`));
  },

  // Questionnaires
  getQuestionnaires: async (params: {
    sectionId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<QuestionnaireDetail>> => {
    const response = await apiClient.get('/teaching/questionnaires', { params });
    return response.data;
  },

  getQuestionnaire: async (id: string): Promise<QuestionnaireDetail> => {
    return fetchApi(apiClient.get(`/teaching/questionnaires/${id}`));
  },

  submitQuestionnaire: async (
    id: string,
    data: { answers: QuestionAnswer[]; studentId?: string }
  ): Promise<SubmissionData> => {
    return fetchApi(apiClient.post(`/teaching/questionnaires/${id}/submit`, data));
  },

  getMyQuestionnaireSubmission: async (id: string): Promise<SubmissionData> => {
    return fetchApi(apiClient.get(`/teaching/questionnaires/${id}/my-submission`));
  },

  // Grades
  getStudentGrades: async (studentId: string): Promise<StudentGrade[]> => {
    return fetchApi(apiClient.get(`/teaching/grades/student/${studentId}`));
  },
};
