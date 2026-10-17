import { apiClient, fetchApi } from './client';

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  type: 'general' | 'academic' | 'event' | 'exam' | 'holiday' | 'urgent';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  targetAudience: {
    type: 'all' | 'class' | 'section' | 'department' | 'specific';
    classIds?: string[];
    sectionIds?: string[];
    departmentIds?: string[];
    studentIds?: string[];
  };
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  publishedAt: string;
  expiresAt?: string;
  createdBy: {
    _id: string;
    displayName: string;
  };
  acknowledgements?: Array<{
    userId: string;
    acknowledgedAt: string;
  }>;
  isAcknowledged?: boolean;
  createdAt: string;
}

export interface Event {
  _id: string;
  title: string;
  description: string;
  type: 'academic' | 'cultural' | 'sports' | 'holiday' | 'exam' | 'meeting' | 'other';
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location?: string;
  organizer?: string;
  targetAudience: {
    type: 'all' | 'class' | 'section' | 'department';
    classIds?: string[];
    sectionIds?: string[];
    departmentIds?: string[];
  };
  createdAt: string;
}

export const announcementsApi = {
  // Get announcements list
  getAnnouncements: async (params?: {
    type?: string;
    priority?: string;
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<{
    announcements: Announcement[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.unreadOnly) queryParams.append('unreadOnly', 'true');

    return fetchApi(apiClient.get(`/communications/announcements?${queryParams.toString()}`));
  },

  // Get single announcement
  getAnnouncement: async (id: string): Promise<Announcement> => {
    return fetchApi(apiClient.get(`/communications/announcements/${id}`));
  },

  // Acknowledge announcement
  acknowledgeAnnouncement: async (id: string): Promise<void> => {
    await apiClient.post(`/communications/announcements/${id}/acknowledge`);
  },

  // Get upcoming events
  getUpcomingEvents: async (params?: {
    type?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Event[]> => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit) queryParams.append('limit', String(params.limit));

    return fetchApi(apiClient.get(`/communications/events/upcoming?${queryParams.toString()}`));
  },

  // Get events for calendar
  getEvents: async (params: { month: number; year: number; type?: string }): Promise<Event[]> => {
    const queryParams = new URLSearchParams();
    queryParams.append('month', String(params.month));
    queryParams.append('year', String(params.year));
    if (params.type) queryParams.append('type', params.type);

    return fetchApi(apiClient.get(`/communications/events?${queryParams.toString()}`));
  },
};
