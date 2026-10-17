import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface AttendanceRecord {
  _id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'half-day' | 'excused';
  checkInTime?: string;
  checkOutTime?: string;
  remarks?: string;
  markedBy: string;
  createdAt: string;
}

export interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  excusedDays: number;
  attendancePercentage: number;
}

export interface MonthlyAttendance {
  month: number;
  year: number;
  records: AttendanceRecord[];
  stats: AttendanceStats;
}

export const attendanceApi = {
  // Student self-service: Get own attendance
  getSelfAttendance: async (params: {
    studentId: string;
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }): Promise<{
    records: AttendanceRecord[];
    stats: AttendanceStats;
  }> => {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.month) queryParams.append('month', String(params.month));
    if (params.year) queryParams.append('year', String(params.year));

    return fetchApi(
      apiClient.get(`/attendance/self/${params.studentId}?${queryParams.toString()}`)
    );
  },

  // Parent: Get all children's attendance
  getChildrenAttendance: async (): Promise<
    Array<{
      studentId: string;
      studentName: string;
      className: string;
      sectionName: string;
      todayStatus?: AttendanceRecord;
      stats: AttendanceStats;
    }>
  > => {
    return fetchApi(apiClient.get('/attendance/parent/children'));
  },

  // Get attendance statistics for a student
  getStudentStats: async (
    studentId: string,
    params?: { month?: number; year?: number }
  ): Promise<AttendanceStats> => {
    const queryParams = new URLSearchParams();
    if (params?.month) queryParams.append('month', String(params.month));
    if (params?.year) queryParams.append('year', String(params.year));

    return fetchApi(
      apiClient.get(`/attendance/students/${studentId}/stats?${queryParams.toString()}`)
    );
  },

  // Get monthly calendar view
  getMonthlyCalendar: async (
    studentId: string,
    month: number,
    year: number
  ): Promise<MonthlyAttendance> => {
    return fetchApi(apiClient.get(`/attendance/self/${studentId}?month=${month}&year=${year}`));
  },
};
