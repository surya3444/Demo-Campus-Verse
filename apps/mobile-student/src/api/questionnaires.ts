import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface QuestionnaireQuestion {
  _id?: string;
  question: string;
  type: 'mcq' | 'short' | 'long' | 'rating' | 'true_false';
  options?: string[];
  required?: boolean;
  marks?: number;
}

export interface Questionnaire {
  _id: string;
  title: string;
  description?: string;
  subjectName?: string;
  type?: 'survey' | 'quiz' | 'feedback';
  status: 'draft' | 'published' | 'closed';
  totalMarks?: number;
  questions: QuestionnaireQuestion[];
  startsAt?: string;
  dueDate?: string;
  durationMinutes?: number;
  hasSubmitted?: boolean;
  createdAt: string;
}

export interface QuestionnaireAnswer {
  questionId?: string;
  questionIndex: number;
  answer: string | number | string[];
}

export const questionnairesApi = {
  list: async (params?: { status?: string }): Promise<Questionnaire[]> => {
    const qp = new URLSearchParams();
    if (params?.status) qp.append('status', params.status);
    const response = await apiClient.get(`/teaching/questionnaires?${qp.toString()}`);
    return response.data.data ?? response.data;
  },
  get: async (id: string): Promise<Questionnaire> =>
    fetchApi(apiClient.get(`/teaching/questionnaires/${id}`)),
  mySubmission: async (
    id: string
  ): Promise<{ answers: QuestionnaireAnswer[]; submittedAt: string } | null> => {
    try {
      const response = await apiClient.get(`/teaching/questionnaires/${id}/my-submission`);
      return response.data.data ?? response.data;
    } catch {
      return null;
    }
  },
  submit: async (id: string, answers: QuestionnaireAnswer[]) =>
    fetchApi(apiClient.post(`/teaching/questionnaires/${id}/submit`, { answers })),
};
