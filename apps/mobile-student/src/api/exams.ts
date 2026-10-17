import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface ExamSchedule {
  _id: string;
  examId: string;
  paperId: string;
  subjectName: string;
  sectionName: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  room?: string;
}

export interface ExamResult {
  _id: string;
  examId: string;
  paperId: string;
  studentId: string;
  studentName: string;
  subjectName: string;
  marksObtained: number;
  totalMarks: number;
  passMarks: number;
  percentage: number;
  grade?: string;
  passed: boolean;
  absent: boolean;
  remarks?: string;
  publishedAt?: string;
}

export const examsApi = {
  listMySchedules: (sectionId: string) =>
    fetchApi<ExamSchedule[]>(apiClient.get('/exams/schedules/list', { params: { sectionId } })),
  listMyResults: (studentId: string) =>
    fetchApi<ExamResult[]>(
      apiClient.get(`/exams/results/student/${studentId}`, {
        params: { onlyPublished: 'true' },
      })
    ),
  listMyReportCards: (studentId: string) =>
    fetchApi<ReportCardSummary[]>(apiClient.get(`/exams/report-cards/student/${studentId}`)),
  listMyHallTickets: (studentId: string) =>
    fetchApi<HallTicketSummary[]>(apiClient.get(`/exams/hall-tickets/student/${studentId}`)),
};

export interface HallTicketSummary {
  _id: string;
  examId: string;
  examName: string;
  termName: string;
  seatNumber?: string;
  venue?: string;
  pdfUrl?: string;
  papers: Array<{
    paperId: string;
    subjectName: string;
    date: string;
    startTime: string;
    endTime: string;
    room?: string;
  }>;
}

export interface ReportCardSummary {
  _id: string;
  examName: string;
  termName: string;
  status: 'draft' | 'published';
  publishedAt?: string;
  overall: {
    percentage: number;
    grade?: string;
    rank?: number;
    passed: boolean;
  };
  pdfUrl?: string;
}
