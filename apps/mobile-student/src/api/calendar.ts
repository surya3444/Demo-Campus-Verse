import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  type: 'academic' | 'cultural' | 'sports' | 'exam' | 'ptm' | 'holiday';
  category?: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  location?: {
    type: 'venue' | 'online' | 'hybrid';
    venue?: string;
    address?: string;
    meetingLink?: string;
  };
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: string;
}

export const calendarApi = {
  getUpcomingEvents: async (limit = 10): Promise<CalendarEvent[]> => {
    return fetchApi(apiClient.get(`/communications/events/upcoming?limit=${limit}`));
  },

  getCalendarEvents: async (year: number, month: number): Promise<CalendarEvent[]> => {
    return fetchApi(apiClient.get(`/communications/events/calendar?year=${year}&month=${month}`));
  },

  getEventDetail: async (id: string): Promise<CalendarEvent> => {
    return fetchApi(apiClient.get(`/communications/events/${id}`));
  },

  getEvents: async (params?: {
    type?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: CalendarEvent[];
    meta: { total: number; page: number; totalPages: number };
  }> => {
    const qp = new URLSearchParams();
    if (params?.type) qp.append('type', params.type);
    if (params?.fromDate) qp.append('fromDate', params.fromDate);
    if (params?.toDate) qp.append('toDate', params.toDate);
    if (params?.page) qp.append('page', String(params.page));
    if (params?.limit) qp.append('limit', String(params.limit));
    const response = await apiClient.get(`/communications/events?${qp.toString()}`);
    return response.data;
  },
};
