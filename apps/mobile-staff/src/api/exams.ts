import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface ExamPaper {
  _id: string;
  subjectId: string;
  subjectName: string;
  totalMarks: number;
  passMarks: number;
}

export interface Exam {
  _id: string;
  name: string;
  termName: string;
  type: string;
  classIds: string[];
  papers: ExamPaper[];
  status: string;
  startDate?: string;
  endDate?: string;
  instructions?: string;
}

export interface ExamSchedule {
  _id: string;
  examId: string;
  paperId: string;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  room?: string;
}

export interface MarkRow {
  _id: string | null;
  studentId: string;
  rollNumber?: string;
  admissionNumber?: string;
  studentName: string;
  marksObtained: number | null;
  absent: boolean;
  percentage?: number | null;
  grade?: string | null;
  passed?: boolean | null;
  remarks?: string;
}

export const examsApi = {
  listExams: () => fetchApi<Exam[]>(apiClient.get('/exams')),
  getExam: (id: string) => fetchApi<Exam>(apiClient.get(`/exams/${id}`)),
  listSchedules: (params: { examId?: string; sectionId?: string }) =>
    fetchApi<ExamSchedule[]>(apiClient.get('/exams/schedules/list', { params })),
  listMarks: (params: { examId: string; paperId: string; sectionId: string }) =>
    fetchApi<MarkRow[]>(apiClient.get('/exams/marks/paper-section', { params })),
  bulkSaveMarks: (data: {
    examId: string;
    paperId: string;
    scheduleId?: string;
    marks: Array<{
      studentId: string;
      marksObtained: number;
      absent?: boolean;
      remarks?: string;
    }>;
  }) => fetchApi(apiClient.post('/exams/marks/bulk', data)),
};
