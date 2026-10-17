import { apiClient } from './client';

export type LiveClassStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type LiveClassRole = 'host' | 'cohost' | 'student';
export type LiveClassPollType = 'single' | 'multi';

export interface LiveClass {
  _id: string;
  tenantId: string;
  branchId: string;
  title: string;
  description?: string;
  classId?: string;
  sectionId: string;
  subjectId?: string;
  hostStaffId: string;
  hostName?: string;
  coHostStaffIds?: string[];
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: LiveClassStatus;
  recordingUrl?: string;
  recordingEnabled?: boolean;
  autoMarkAttendance?: boolean;
  attendanceThresholdPct?: number;
  settings?: {
    chatEnabled?: boolean;
    studentCanUnmute?: boolean;
    studentCanDraw?: boolean;
    recordingEnabled?: boolean;
  };
  className?: string;
  sectionName?: string;
  subjectName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveClassJoinResponse {
  liveClassId: string;
  livekitUrl: string;
  livekitToken: string;
  socketUrl: string;
  role: LiveClassRole;
  identity: string;
  displayName: string;
}

export const liveClassApi = {
  list: async (params?: {
    sectionId?: string;
    classId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    mine?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: LiveClass[]; meta: unknown }> => {
    const r = await apiClient.get('/teaching/live-classes', { params });
    return r.data;
  },

  create: async (data: {
    title: string;
    description?: string;
    classId?: string;
    sectionId: string;
    subjectId?: string;
    coHostStaffIds?: string[];
    scheduledStart: string;
    scheduledEnd: string;
    recordingEnabled?: boolean;
    autoMarkAttendance?: boolean;
    settings?: LiveClass['settings'];
  }): Promise<{ data: LiveClass }> => {
    const r = await apiClient.post('/teaching/live-classes', data);
    return r.data;
  },

  getById: async (id: string): Promise<{ data: LiveClass }> => {
    const r = await apiClient.get(`/teaching/live-classes/${id}`);
    return r.data;
  },

  start: async (id: string): Promise<{ data: LiveClass }> => {
    const r = await apiClient.post(`/teaching/live-classes/${id}/start`);
    return r.data;
  },

  end: async (id: string): Promise<{ data: LiveClass }> => {
    const r = await apiClient.post(`/teaching/live-classes/${id}/end`);
    return r.data;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.post(`/teaching/live-classes/${id}/cancel`);
  },

  join: async (id: string): Promise<{ data: LiveClassJoinResponse }> => {
    const r = await apiClient.post(`/teaching/live-classes/${id}/join`);
    return r.data;
  },

  listMessages: async (id: string, params?: { page?: number; limit?: number }) => {
    const r = await apiClient.get(`/teaching/live-classes/${id}/messages`, { params });
    return r.data;
  },

  listPolls: async (id: string) => {
    const r = await apiClient.get(`/teaching/live-classes/${id}/polls`);
    return r.data;
  },

  listParticipants: async (id: string) => {
    const r = await apiClient.get(`/teaching/live-classes/${id}/participants`);
    return r.data;
  },

  kick: async (id: string, userId: string): Promise<void> => {
    await apiClient.post(`/teaching/live-classes/${id}/kick`, { userId });
  },

  muteAll: async (id: string): Promise<{ data: { mutedCount: number } }> => {
    const r = await apiClient.post(`/teaching/live-classes/${id}/mute-all`);
    return r.data;
  },

  updateLiveSettings: async (
    id: string,
    settings: {
      chatEnabled?: boolean;
      studentCanUnmute?: boolean;
      studentCanDraw?: boolean;
      recordingEnabled?: boolean;
    }
  ): Promise<{ data: LiveClass }> => {
    const r = await apiClient.patch(`/teaching/live-classes/${id}/settings`, settings);
    return r.data;
  },

  startRecording: async (
    id: string
  ): Promise<{ data: { egressId: string; status: 'pending' | 'ready' | 'failed' } }> => {
    const r = await apiClient.post(`/teaching/live-classes/${id}/recording/start`);
    return r.data;
  },

  stopRecording: async (id: string): Promise<void> => {
    await apiClient.post(`/teaching/live-classes/${id}/recording/stop`);
  },

  // Helper for the schedule form's co-host picker. Returns at most `limit`
  // teaching staff for the current branch.
  listTeachingStaff: async (
    limit = 200
  ): Promise<{
    data: Array<{ _id: string; firstName?: string; lastName?: string; email?: string }>;
  }> => {
    const r = await apiClient.get('/hr/staff', {
      params: { isTeaching: true, status: 'active', limit },
    });
    return r.data;
  },
};
