import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface BedAllocation {
  _id: string;
  hostelId: string;
  hostelName: string;
  roomId: string;
  roomNumber: string;
  bedNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
  allocationDate: string;
  expectedVacatingDate?: string;
  actualVacatingDate?: string;
  status: 'active' | 'vacated' | 'transferred' | 'cancelled';
  vacatingReason?: string;
  createdAt: string;
}

export interface Hostel {
  _id: string;
  name: string;
  code?: string;
  type?: string;
  gender?: string;
  capacity?: number;
  wardenName?: string;
  wardenContact?: string;
  address?: string;
  facilities?: string[];
  status: 'active' | 'inactive';
}

export const hostelApi = {
  getMyAllocation: async (studentId: string): Promise<BedAllocation | null> => {
    try {
      return await fetchApi(apiClient.get(`/hostel/allocations/student/${studentId}`));
    } catch {
      return null;
    }
  },

  getHostels: async (): Promise<Hostel[]> => {
    const result = await fetchApi<Hostel[] | { data: Hostel[] }>(apiClient.get('/hostel/hostels'));
    return Array.isArray(result) ? result : (result as { data: Hostel[] }).data || [];
  },
};
