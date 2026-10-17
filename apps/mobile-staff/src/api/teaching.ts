import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';
import type {
  TimetableSlot,
  TimetableEntry,
  Assignment,
  PaginatedResponse,
} from '@campus-verse/mobile-shared/api/types';
export type { TimetableSlot, TimetableEntry, Assignment, PaginatedResponse };

// ============ Types ============

export interface TeachingClass {
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  // API returns parallel arrays, not objects
  subjectIds?: string[];
  subjectNames?: string[];
  // Normalized accessor (computed in getSubjects helper)
  subjects?: Array<{ subjectId: string; subjectName: string }>;
  studentCount: number;
  isClassTeacher: boolean;
  averageAttendance?: number;
  source?: string;
}

/** Normalize the parallel arrays into a { subjectId, subjectName }[] */
export function getSubjects(cls: TeachingClass): Array<{ subjectId: string; subjectName: string }> {
  if (cls.subjectIds && cls.subjectNames) {
    return cls.subjectIds.map((id, i) => ({
      subjectId: id,
      subjectName: cls.subjectNames![i] || id,
    }));
  }
  return cls.subjects || [];
}

export interface LessonPlan {
  _id: string;
  title: string;
  sectionId: string;
  sectionName?: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherName?: string;
  date: string;
  objectives: string[];
  description: string;
  resources: string[];
  status: 'draft' | 'published';
  teachingStatus: string;
  slotId?: string;
  duration?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentInSection {
  _id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  admissionNumber: string;
  status: string;
  profileImage?: string;
}

export interface Grade {
  _id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  marksObtained: number;
  remarks?: string;
}

export interface SectionReportItem {
  assignmentId: string;
  assignmentTitle: string;
  dueDate: string;
  totalMarks: number;
  averageScore: number;
  studentsGraded: number;
  totalStudents: number;
}

// ============ API ============

export const teachingApi = {
  // My Classes
  getMyClasses: async (): Promise<TeachingClass[]> => {
    return fetchApi(apiClient.get('/teaching/my-classes'));
  },

  getSectionStudents: async (
    sectionId: string,
    params?: { search?: string; page?: number; limit?: number }
  ): Promise<{
    data: StudentInSection[];
    meta: { total: number; page: number; totalPages: number };
  }> => {
    const response = await apiClient.get(`/teaching/my-classes/${sectionId}/students`, { params });
    return response.data;
  },

  getSectionLessonPlans: async (
    sectionId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{ data: LessonPlan[]; meta: { total: number; page: number; totalPages: number } }> => {
    const response = await apiClient.get(`/teaching/my-classes/${sectionId}/lesson-plans`, {
      params,
    });
    return response.data;
  },

  // Timetable
  getMyTimetable: async (): Promise<TimetableEntry[]> => {
    return fetchApi(apiClient.get('/teaching/timetable/my'));
  },

  getSlots: async (classId?: string): Promise<TimetableSlot[]> => {
    return fetchApi(
      apiClient.get('/teaching/timetable/slots', {
        params: classId ? { classId } : {},
      })
    );
  },

  // Lesson Plans
  getLessonPlans: async (params?: {
    page?: number;
    limit?: number;
    sectionId?: string;
    subjectId?: string;
    status?: string;
    teachingStatus?: string;
  }): Promise<{
    data: LessonPlan[];
    meta: { total: number; page: number; totalPages: number; hasMore: boolean };
  }> => {
    const response = await apiClient.get('/teaching/lesson-plans', { params });
    return response.data;
  },

  getLessonPlan: async (id: string): Promise<LessonPlan> => {
    return fetchApi(apiClient.get(`/teaching/lesson-plans/${id}`));
  },

  createLessonPlan: async (data: {
    title: string;
    sectionId: string;
    subjectId: string;
    date: string;
    objectives?: string[];
    description?: string;
    resources?: string[];
    status?: string;
    slotId?: string;
    duration?: number;
  }): Promise<LessonPlan> => {
    return fetchApi(apiClient.post('/teaching/lesson-plans', data));
  },

  updateLessonPlan: async (id: string, data: Record<string, unknown>): Promise<LessonPlan> => {
    return fetchApi(apiClient.put(`/teaching/lesson-plans/${id}`, data));
  },

  deleteLessonPlan: async (id: string): Promise<void> => {
    await apiClient.delete(`/teaching/lesson-plans/${id}`);
  },

  updateLessonPlanTeachingStatus: async (
    id: string,
    data: { teachingStatus: string; linkedAssignmentId?: string }
  ): Promise<LessonPlan> => {
    return fetchApi(apiClient.put(`/teaching/lesson-plans/${id}/teaching-status`, data));
  },

  // Assignments
  getAssignments: async (params?: {
    page?: number;
    limit?: number;
    sectionId?: string;
    subjectId?: string;
    status?: string;
  }): Promise<{
    data: Assignment[];
    meta: { total: number; page: number; totalPages: number; hasMore: boolean };
  }> => {
    const response = await apiClient.get('/teaching/assignments', { params });
    return response.data;
  },

  getAssignment: async (id: string): Promise<Assignment> => {
    return fetchApi(apiClient.get(`/teaching/assignments/${id}`));
  },

  createAssignment: async (data: {
    title: string;
    description?: string;
    sectionId: string;
    subjectId: string;
    dueDate: string;
    totalMarks: number;
  }): Promise<Assignment> => {
    return fetchApi(apiClient.post('/teaching/assignments', data));
  },

  updateAssignment: async (id: string, data: Record<string, unknown>): Promise<Assignment> => {
    return fetchApi(apiClient.put(`/teaching/assignments/${id}`, data));
  },

  deleteAssignment: async (id: string): Promise<void> => {
    await apiClient.delete(`/teaching/assignments/${id}`);
  },

  publishAssignment: async (id: string): Promise<Assignment> => {
    return fetchApi(apiClient.put(`/teaching/assignments/${id}/publish`));
  },

  startGrading: async (id: string): Promise<Assignment> => {
    return fetchApi(apiClient.put(`/teaching/assignments/${id}/start-grading`));
  },

  completeAssignment: async (id: string): Promise<Assignment> => {
    return fetchApi(apiClient.put(`/teaching/assignments/${id}/complete`));
  },

  // Grades
  getAssignmentGrades: async (
    assignmentId: string
  ): Promise<{ grades: Grade[]; assignment: Assignment }> => {
    return fetchApi(apiClient.get(`/teaching/grades/assignment/${assignmentId}`));
  },

  getSectionReport: async (sectionId: string): Promise<SectionReportItem[]> => {
    return fetchApi(apiClient.get('/teaching/grades/section-report', { params: { sectionId } }));
  },

  gradeStudent: async (data: {
    assignmentId: string;
    studentId: string;
    marksObtained: number;
    remarks?: string;
  }): Promise<Grade> => {
    return fetchApi(apiClient.post('/teaching/grades', data));
  },

  bulkGrade: async (data: {
    assignmentId: string;
    grades: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
  }): Promise<void> => {
    await apiClient.post('/teaching/grades/bulk', data);
  },
};

// ============ Attendance Types ============

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day' | 'leave';

export interface AttendanceRecord {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  rollNumber?: number;
  status: AttendanceStatus | null;
}

export interface AttendanceData {
  _id?: string;
  date: string;
  classId: string;
  sectionId: string;
  isMarked: boolean;
  isLocked: boolean;
  records: AttendanceRecord[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    leave: number;
  };
}

// ============ Attendance API ============

export const attendanceTeacherApi = {
  getAttendance: async (params: {
    classId: string;
    sectionId: string;
    date: string;
  }): Promise<AttendanceData> => {
    return fetchApi(apiClient.get('/attendance/students', { params }));
  },

  markAttendance: async (data: {
    classId: string;
    sectionId: string;
    date: string;
    records: Array<{
      studentId: string;
      status: AttendanceStatus;
      remarks?: string;
    }>;
  }): Promise<AttendanceData> => {
    return fetchApi(apiClient.post('/attendance/students', data));
  },

  lockAttendance: async (attendanceId: string): Promise<void> => {
    await apiClient.put(`/attendance/students/${attendanceId}/lock`);
  },
};
