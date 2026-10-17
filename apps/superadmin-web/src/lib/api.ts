import axios, { type AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const adminApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getAdminToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('adminAccessToken');
};

export const setAdminToken = (token: string, expiresIn: number): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('adminAccessToken', token);
  localStorage.setItem('adminTokenExpiry', String(Date.now() + expiresIn * 1000));
};

export const clearAdminToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('adminAccessToken');
  localStorage.removeItem('adminTokenExpiry');
  localStorage.removeItem('adminUser');
};

export const getAdminUser = (): unknown => {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('adminUser');
  return user ? JSON.parse(user) : null;
};

export const setAdminUser = (user: unknown): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('adminUser', JSON.stringify(user));
};

export const isAdminAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = getAdminToken();
  const expiry = localStorage.getItem('adminTokenExpiry');
  if (!token || !expiry) return false;
  return Date.now() < parseInt(expiry);
};

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const adminAuthApi = {
  login: async (email: string, password: string) => {
    const response = await adminApi.post('/admin/login', { email, password });
    return response.data;
  },

  logout: async () => {
    const response = await adminApi.post('/admin/logout');
    return response.data;
  },

  refresh: async () => {
    const response = await adminApi.post('/admin/refresh');
    return response.data;
  },
};

export const organizationsApi = {
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const response = await adminApi.get('/admin/organizations', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await adminApi.get(`/admin/organizations/${id}`);
    return response.data;
  },

  approve: async (id: string, data?: { approvedModules?: string[]; subscriptionPlan?: string }) => {
    const response = await adminApi.put(`/admin/organizations/${id}/approve`, data || {});
    return response.data;
  },

  reject: async (id: string, reason: string) => {
    const response = await adminApi.put(`/admin/organizations/${id}/reject`, { reason });
    return response.data;
  },

  updateModules: async (id: string, modules: string[]) => {
    const response = await adminApi.put(`/admin/organizations/${id}/modules`, { modules });
    return response.data;
  },

  /** Permanently delete an org (and, if approved, its entire tenant data). */
  delete: async (id: string, confirmName: string) => {
    const response = await adminApi.delete(`/admin/organizations/${id}`, {
      data: { confirmName },
    });
    return response.data as {
      success: boolean;
      data: { deletedTenant: boolean; collectionsPurged: number; documentsDeleted: number };
    };
  },
};

export const adminDashboardApi = {
  getStats: async () => {
    const response = await adminApi.get('/admin/dashboard/stats');
    return response.data;
  },
};

export interface PlatformStatistics {
  organizations: { total: number; active: number; pendingApprovals: number; newThisMonth: number };
  students: { total: number; active: number; newThisMonth: number };
  staff: { total: number; teachers: number; nonTeaching: number };
  branches: number;
  users: number;
  byInstitutionType: Array<{ type: string; count: number }>;
  topOrganizations: Array<{
    id: string;
    name: string;
    institutionType: string;
    students: number;
  }>;
  monthlyGrowth: Array<{ month: string; organizations: number; students: number }>;
}

export const adminStatisticsApi = {
  get: async () => {
    const response = await adminApi.get('/admin/statistics');
    return response.data as { success: boolean; data: PlatformStatistics };
  },
};

/** Stage keys are dynamic — the UI loads them from the pipeline endpoint. */
export type LeadStage = string;

export type StageColor =
  | 'slate'
  | 'blue'
  | 'amber'
  | 'violet'
  | 'emerald'
  | 'rose'
  | 'sky'
  | 'fuchsia'
  | 'lime'
  | 'orange'
  | 'teal';

export interface PipelineStage {
  key: string;
  label: string;
  color: StageColor;
  order: number;
  isPermanent: boolean;
}

export interface MarketingLead {
  id: string;
  firstName: string;
  lastName?: string;
  institution: string;
  institutionType?: string;
  phone?: string;
  email: string;
  message?: string;
  source: 'demo_request' | 'contact_form' | 'manual';
  stage: LeadStage;
  notes: Array<{
    id: string;
    note: string;
    createdBy: string;
    createdByName?: string;
    createdAt: string;
  }>;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    page?: string;
  };
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  contactedAt?: string;
  wonAt?: string;
  lostAt?: string;
  lostReason?: string;
}

export const leadsApi = {
  list: async (params?: { stage?: LeadStage; search?: string }) => {
    const response = await adminApi.get('/marketing-leads/admin', { params });
    return response.data as { success: boolean; data: MarketingLead[] };
  },

  get: async (id: string) => {
    const response = await adminApi.get(`/marketing-leads/admin/${id}`);
    return response.data as { success: boolean; data: MarketingLead };
  },

  updateStage: async (id: string, stage: LeadStage, lostReason?: string) => {
    const response = await adminApi.patch(`/marketing-leads/admin/${id}/stage`, {
      stage,
      lostReason,
    });
    return response.data as { success: boolean; data: MarketingLead };
  },

  addNote: async (id: string, note: string) => {
    const response = await adminApi.post(`/marketing-leads/admin/${id}/notes`, { note });
    return response.data as { success: boolean; data: MarketingLead };
  },

  stats: async () => {
    const response = await adminApi.get('/marketing-leads/admin/stats');
    return response.data as {
      success: boolean;
      data: { total: number; byStage: Record<string, number>; orphans: Record<string, number> };
    };
  },

  delete: async (id: string) => {
    const response = await adminApi.delete(`/marketing-leads/admin/${id}`);
    return response.data as { success: boolean; data: { id: string } };
  },
};

export const pipelineApi = {
  get: async () => {
    const response = await adminApi.get('/marketing-leads/admin/pipeline');
    return response.data as { success: boolean; data: PipelineStage[] };
  },
  addStage: async (input: { label: string; color?: StageColor; afterKey?: string }) => {
    const response = await adminApi.post('/marketing-leads/admin/pipeline/stages', input);
    return response.data as { success: boolean; data: PipelineStage[] };
  },
  updateStage: async (key: string, input: { label?: string; color?: StageColor }) => {
    const response = await adminApi.patch(
      `/marketing-leads/admin/pipeline/stages/${encodeURIComponent(key)}`,
      input
    );
    return response.data as { success: boolean; data: PipelineStage[] };
  },
  deleteStage: async (key: string, reassignTo: string) => {
    const response = await adminApi.delete(
      `/marketing-leads/admin/pipeline/stages/${encodeURIComponent(key)}`,
      { data: { reassignTo } }
    );
    return response.data as { success: boolean; data: PipelineStage[] };
  },
  reorder: async (orderedKeys: string[]) => {
    const response = await adminApi.put('/marketing-leads/admin/pipeline/order', {
      orderedKeys,
    });
    return response.data as { success: boolean; data: PipelineStage[] };
  },
};

export type BlogStatus = 'draft' | 'published';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  emoji?: string;
  tag: string;
  status: BlogStatus;
  authorName: string;
  readingMinutes: number;
  order: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface BlogPostInput {
  title: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  emoji?: string;
  tag?: string;
  authorName?: string;
  status?: BlogStatus;
}

export const blogApi = {
  list: async (params?: {
    status?: BlogStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await adminApi.get('/blog/admin', { params });
    return response.data as {
      success: boolean;
      data: BlogPost[];
      meta: { total: number; page: number; limit: number };
    };
  },
  get: async (id: string) => {
    const response = await adminApi.get(`/blog/admin/${id}`);
    return response.data as { success: boolean; data: BlogPost };
  },
  create: async (input: BlogPostInput) => {
    const response = await adminApi.post('/blog/admin', input);
    return response.data as { success: boolean; data: BlogPost };
  },
  update: async (id: string, input: BlogPostInput) => {
    const response = await adminApi.put(`/blog/admin/${id}`, input);
    return response.data as { success: boolean; data: BlogPost };
  },
  setStatus: async (id: string, status: BlogStatus) => {
    const response = await adminApi.patch(`/blog/admin/${id}/status`, { status });
    return response.data as { success: boolean; data: BlogPost };
  },
  remove: async (id: string) => {
    await adminApi.delete(`/blog/admin/${id}`);
  },
  reorder: async (orderedIds: string[]) => {
    const response = await adminApi.put('/blog/admin/reorder', { orderedIds });
    return response.data as { success: boolean };
  },
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await adminApi.post('/blog/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { success: boolean; data: { url: string; key: string } };
  },
};

// ─────────────── Careers (Vacancies + Applications) ───────────────

export type VacancyStatus = 'draft' | 'published' | 'closed';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';
export type WorkMode = 'onsite' | 'remote' | 'hybrid';

export type ApplicationStatus =
  | 'new'
  | 'in_review'
  | 'shortlisted'
  | 'interviewing'
  | 'offered'
  | 'hired'
  | 'rejected';

export interface Vacancy {
  id: string;
  title: string;
  slug: string;
  department: string;
  category: string;
  location: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  experience?: string;
  salaryRange?: string;
  hideSalary?: boolean;
  shortDescription: string;
  description: string;
  status: VacancyStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  closedAt?: string;
}

export interface VacancyInput {
  title: string;
  department?: string;
  category?: string;
  location?: string;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  experience?: string;
  salaryRange?: string;
  hideSalary?: boolean;
  shortDescription?: string;
  description: string;
  status?: VacancyStatus;
}

export interface CareerApplication {
  id: string;
  vacancyId: string;
  vacancyTitle: string;
  fullName: string;
  email: string;
  phone: string;
  coverLetter?: string;
  resumeUrl: string;
  resumeFileName?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  status: ApplicationStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const vacanciesApi = {
  list: async (params?: { status?: VacancyStatus; search?: string }) => {
    const response = await adminApi.get('/careers/admin/vacancies', { params });
    return response.data as {
      success: boolean;
      data: Vacancy[];
      meta: { total: number; page: number; limit: number };
    };
  },
  get: async (id: string) => {
    const response = await adminApi.get(`/careers/admin/vacancies/${id}`);
    return response.data as { success: boolean; data: Vacancy };
  },
  create: async (input: VacancyInput) => {
    const response = await adminApi.post('/careers/admin/vacancies', input);
    return response.data as { success: boolean; data: Vacancy };
  },
  update: async (id: string, input: VacancyInput) => {
    const response = await adminApi.put(`/careers/admin/vacancies/${id}`, input);
    return response.data as { success: boolean; data: Vacancy };
  },
  setStatus: async (id: string, status: VacancyStatus) => {
    const response = await adminApi.patch(`/careers/admin/vacancies/${id}/status`, { status });
    return response.data as { success: boolean; data: Vacancy };
  },
  remove: async (id: string) => {
    await adminApi.delete(`/careers/admin/vacancies/${id}`);
  },
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await adminApi.post('/careers/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data as { success: boolean; data: { url: string; key: string } };
  },
};

export const careerApplicationsApi = {
  list: async (params?: { vacancyId?: string; status?: ApplicationStatus; search?: string }) => {
    const response = await adminApi.get('/careers/admin/applications', { params });
    return response.data as {
      success: boolean;
      data: CareerApplication[];
      meta: { total: number; page: number; limit: number };
    };
  },
  get: async (id: string) => {
    const response = await adminApi.get(`/careers/admin/applications/${id}`);
    return response.data as { success: boolean; data: CareerApplication };
  },
  updateStatus: async (id: string, status: ApplicationStatus, notes?: string) => {
    const response = await adminApi.patch(`/careers/admin/applications/${id}/status`, {
      status,
      notes,
    });
    return response.data as { success: boolean; data: CareerApplication };
  },
  remove: async (id: string) => {
    await adminApi.delete(`/careers/admin/applications/${id}`);
  },
};

export { adminApi };
