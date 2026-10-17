import { apiClient, fetchApi } from './client';

export interface Course {
  _id: string;
  title: string;
  description?: string;
  subjectId?: string;
  subjectName?: string;
  thumbnail?: string;
  status: 'draft' | 'published' | 'archived';
  visibility?: 'private' | 'section' | 'class' | 'branch' | 'public';
  targetSectionIds?: string[];
  targetClassIds?: string[];
  instructorId: string;
  instructorName?: string;
  lessonCount?: number;
  quizCount?: number;
  enrollmentCount?: number;
  completionRate?: number;
  createdAt: string;
}

export interface CourseLesson {
  _id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  contentType: 'video' | 'text' | 'pdf' | 'link';
  contentUrl?: string;
  contentBody?: string;
  durationMinutes?: number;
  status: 'draft' | 'published';
  createdAt: string;
}

export interface CourseQuiz {
  _id: string;
  courseId: string;
  title: string;
  description?: string;
  totalMarks: number;
  passingMarks?: number;
  durationMinutes?: number;
  questions: Array<{
    question: string;
    type: 'mcq' | 'true_false' | 'short';
    options?: string[];
    correctAnswer?: string | number;
    marks: number;
  }>;
  status: 'draft' | 'published';
  createdAt: string;
}

export interface CourseEnrollment {
  _id: string;
  courseId: string;
  studentId: string;
  student?: {
    _id: string;
    displayName: string;
    admissionNumber?: string;
    profileImage?: string;
  };
  progress: number;
  status: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  completedAt?: string;
  createdAt: string;
}

export const coursesApi = {
  getCourses: async (params?: {
    status?: string;
    instructorId?: string;
    mine?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: Course[]; meta?: { total: number; totalPages: number } }> => {
    const qp = new URLSearchParams();
    if (params?.status) qp.append('status', params.status);
    if (params?.instructorId) qp.append('instructorId', params.instructorId);
    if (params?.mine) qp.append('mine', 'true');
    if (params?.page) qp.append('page', String(params.page));
    if (params?.limit) qp.append('limit', String(params.limit));
    const response = await apiClient.get(`/courses?${qp.toString()}`);
    return response.data;
  },

  getCourse: async (id: string): Promise<Course> => {
    return fetchApi(apiClient.get(`/courses/${id}`));
  },

  createCourse: async (data: {
    title: string;
    description?: string;
    subjectId?: string;
    targetSectionIds?: string[];
  }): Promise<Course> => {
    return fetchApi(apiClient.post('/courses', data));
  },

  updateCourse: async (id: string, data: Partial<Course>): Promise<Course> => {
    return fetchApi(apiClient.put(`/courses/${id}`, data));
  },

  deleteCourse: async (id: string): Promise<void> => {
    await apiClient.delete(`/courses/${id}`);
  },

  // Lessons
  getLessons: async (courseId: string): Promise<CourseLesson[]> => {
    const response = await apiClient.get(`/courses/${courseId}/lessons`);
    return response.data.data;
  },

  createLesson: async (
    courseId: string,
    data: {
      title: string;
      description?: string;
      contentType: 'video' | 'text' | 'pdf' | 'link';
      contentUrl?: string;
      contentBody?: string;
      durationMinutes?: number;
    }
  ): Promise<CourseLesson> => {
    return fetchApi(apiClient.post(`/courses/${courseId}/lessons`, data));
  },

  updateLesson: async (
    courseId: string,
    lessonId: string,
    data: Partial<CourseLesson>
  ): Promise<CourseLesson> => {
    return fetchApi(apiClient.put(`/courses/${courseId}/lessons/${lessonId}`, data));
  },

  deleteLesson: async (courseId: string, lessonId: string): Promise<void> => {
    await apiClient.delete(`/courses/${courseId}/lessons/${lessonId}`);
  },

  // Quizzes
  getQuizzes: async (courseId: string): Promise<CourseQuiz[]> => {
    const response = await apiClient.get(`/courses/${courseId}/quizzes`);
    return response.data.data;
  },

  createQuiz: async (
    courseId: string,
    data: {
      title: string;
      description?: string;
      totalMarks: number;
      questions: CourseQuiz['questions'];
      passingMarks?: number;
      durationMinutes?: number;
    }
  ): Promise<CourseQuiz> => {
    return fetchApi(apiClient.post(`/courses/${courseId}/quizzes`, data));
  },

  deleteQuiz: async (courseId: string, quizId: string): Promise<void> => {
    await apiClient.delete(`/courses/${courseId}/quizzes/${quizId}`);
  },

  // Enrollments
  getEnrollments: async (courseId: string): Promise<CourseEnrollment[]> => {
    const response = await apiClient.get(`/courses/enrollments?courseId=${courseId}`);
    return response.data.data;
  },
};
