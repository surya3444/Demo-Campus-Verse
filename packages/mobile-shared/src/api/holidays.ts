import { apiClient } from './client';

export interface Holiday {
  _id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  type: 'national' | 'religious' | 'school' | 'state' | 'other';
  isOptional?: boolean;
  createdAt: string;
}

export const holidaysApi = {
  getHolidays: async (params?: {
    fromDate?: string;
    toDate?: string;
    year?: number;
  }): Promise<Holiday[]> => {
    const qp = new URLSearchParams();
    if (params?.fromDate) qp.append('fromDate', params.fromDate);
    if (params?.toDate) qp.append('toDate', params.toDate);
    if (params?.year) qp.append('year', String(params.year));
    const response = await apiClient.get(`/attendance/holidays?${qp.toString()}`);
    return response.data.data || response.data;
  },
};
