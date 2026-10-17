import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface HealthRecord {
  _id: string;
  personType: 'student' | 'staff';
  personId: string;
  personName?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  allergies: Array<{
    name: string;
    category: string;
    severity: string;
    symptoms?: string[];
    treatment?: string;
  }>;
  conditions: Array<{
    name: string;
    status: string;
    diagnosedDate?: string;
    medications?: string[];
    notes?: string;
  }>;
  currentMedications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    reason?: string;
  }>;
  emergencyContacts: Array<{
    name: string;
    relation: string;
    phone: string;
    isPrimary?: boolean;
  }>;
  insurance?: {
    provider?: string;
    policyNumber?: string;
    validFrom?: string;
    validTo?: string;
  };
  lastCheckupDate?: string;
  nextCheckupDate?: string;
  hasOverdueVaccinations?: boolean;
  status: 'active' | 'inactive';
}

export interface Vaccination {
  _id: string;
  vaccineName: string;
  vaccineCode?: string;
  manufacturer?: string;
  doseNumber: number;
  totalDoses?: number;
  scheduledDate?: string;
  administeredDate?: string;
  status: 'scheduled' | 'completed' | 'missed' | 'overdue' | 'exempt';
  sideEffects?: string[];
  nextDoseDate?: string;
  notes?: string;
}

export interface Checkup {
  _id: string;
  checkupType: 'routine' | 'annual' | 'sports' | 'pre-admission' | 'follow-up' | 'other';
  checkupDate: string;
  findings?: string;
  recommendations?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  conductedBy?: string;
}

export interface MedicalVisit {
  _id: string;
  visitType: 'routine' | 'illness' | 'injury' | 'emergency' | 'follow-up' | 'other';
  arrivalTime: string;
  departureTime?: string;
  chief_complaint: string;
  diagnosis?: string;
  treatment?: string;
  outcome: 'returned_to_class' | 'sent_home' | 'referred' | 'hospitalized' | 'under_observation';
  status: 'in_progress' | 'completed' | 'follow_up_required';
  createdAt: string;
}

export const healthApi = {
  getMyRecord: async (studentId: string): Promise<HealthRecord | null> => {
    try {
      return await fetchApi(apiClient.get(`/health/records/person/student/${studentId}`));
    } catch {
      return null;
    }
  },

  getMyVaccinations: async (studentId: string): Promise<Vaccination[]> => {
    const result = await fetchApi<Vaccination[] | { data: Vaccination[] }>(
      apiClient.get(`/health/vaccinations?personId=${studentId}&personType=student`)
    );
    return Array.isArray(result) ? result : (result as { data: Vaccination[] }).data || [];
  },

  getDueVaccinations: async (): Promise<Vaccination[]> => {
    const result = await fetchApi<Vaccination[] | { data: Vaccination[] }>(
      apiClient.get('/health/vaccinations/due')
    );
    return Array.isArray(result) ? result : (result as { data: Vaccination[] }).data || [];
  },

  getMyCheckups: async (studentId: string): Promise<Checkup[]> => {
    const result = await fetchApi<Checkup[] | { data: Checkup[] }>(
      apiClient.get(`/health/checkups?personId=${studentId}&personType=student`)
    );
    return Array.isArray(result) ? result : (result as { data: Checkup[] }).data || [];
  },

  getMyVisits: async (studentId: string): Promise<MedicalVisit[]> => {
    const result = await fetchApi<MedicalVisit[] | { data: MedicalVisit[] }>(
      apiClient.get(`/health/visits?personId=${studentId}&personType=student`)
    );
    return Array.isArray(result) ? result : (result as { data: MedicalVisit[] }).data || [];
  },
};
