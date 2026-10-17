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
};
