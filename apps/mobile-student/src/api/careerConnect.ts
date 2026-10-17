import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface Job {
  _id: string;
  title: string;
  companyId: string;
  companyName?: string;
  description?: string;
  jobType?: 'fulltime' | 'internship' | 'contract' | 'parttime';
  location?: string;
  salaryRange?: { min?: number; max?: number; currency?: string };
  skills?: string[];
  eligibility?: { minGpa?: number; departments?: string[]; year?: number };
  status: 'draft' | 'open' | 'closed' | 'archived';
  applicationDeadline?: string;
  openings?: number;
  createdAt: string;
}

export interface JobApplication {
  _id: string;
  jobId: string;
  job?: Job;
  studentId: string;
  status: 'submitted' | 'shortlisted' | 'rejected' | 'selected' | 'offered' | 'withdrawn';
  coverLetter?: string;
  appliedAt: string;
}

export interface Drive {
  _id: string;
  companyId: string;
  companyName?: string;
  title: string;
  driveType?: 'on-campus' | 'off-campus' | 'pool';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  driveDate: string;
  rounds?: Array<{ _id: string; name: string; type: string }>;
  eligibility?: { minGpa?: number; departments?: string[]; year?: number };
  registrationOpen?: boolean;
}

export interface CounselingSession {
  _id: string;
  studentId: string;
  counselorId: string;
  counselorName?: string;
  scheduledAt: string;
  durationMinutes: number;
  topic: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  mode: 'in_person' | 'video' | 'phone';
}

export const careerConnectApi = {
  // Jobs
  getJobs: async (params?: { status?: string; jobType?: string; limit?: number }) => {
    const qp = new URLSearchParams();
    if (params?.status) qp.append('status', params.status);
    if (params?.jobType) qp.append('jobType', params.jobType);
    if (params?.limit) qp.append('limit', String(params.limit));
    const response = await apiClient.get(`/career-connect/jobs?${qp.toString()}`);
    return response.data as { data: Job[]; meta?: { total: number } };
  },
  getJob: async (id: string): Promise<Job> => fetchApi(apiClient.get(`/career-connect/jobs/${id}`)),
  applyToJob: async (jobId: string, data: { coverLetter?: string }) =>
    fetchApi(apiClient.post(`/career-connect/jobs/${jobId}/apply`, data)),
  myApplications: async (): Promise<JobApplication[]> => {
    const response = await apiClient.get('/career-connect/applications/my');
    return response.data.data;
  },

  // Drives
  getDrives: async (params?: { status?: string }) => {
    const qp = new URLSearchParams();
    if (params?.status) qp.append('status', params.status);
    const response = await apiClient.get(`/career-connect/drives?${qp.toString()}`);
    return response.data as { data: Drive[]; meta?: { total: number } };
  },
  registerForDrive: async (driveId: string) =>
    fetchApi(apiClient.post(`/career-connect/drives/${driveId}/register`, {})),

  // Counseling
  getCounselingSessions: async (): Promise<CounselingSession[]> => {
    const response = await apiClient.get('/career-connect/counseling/sessions');
    return response.data.data;
  },

  // Student profile (for "my profile" view)
  getMyProfile: async () => fetchApi(apiClient.get('/career-connect/student-profiles/my')),
};
