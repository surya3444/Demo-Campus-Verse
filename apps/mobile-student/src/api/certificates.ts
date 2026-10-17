import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface CertificateType {
  _id: string;
  name: string;
  code: string;
  category: 'student' | 'staff';
  requiresApproval: boolean;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'date' | 'number' | 'select';
    required: boolean;
    options?: string[];
  }>;
  status: 'active' | 'inactive';
}

export interface CertificateRequest {
  _id: string;
  certificateNumber?: string;
  certificateTypeId: string;
  certificateTypeName?: string;
  certificateTypeCode?: string;
  purpose?: string;
  fieldValues: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'issued' | 'cancelled';
  rejectionReason?: string;
  issuedAt?: string;
  generatedDocument?: {
    url: string;
    generatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const certificatesApi = {
  getTypes: async (): Promise<CertificateType[]> => {
    const result = await fetchApi<CertificateType[] | { data: CertificateType[] }>(
      apiClient.get('/certificates/types')
    );
    return Array.isArray(result) ? result : (result as { data: CertificateType[] }).data || [];
  },

  getMyRequests: async (studentId: string): Promise<CertificateRequest[]> => {
    const result = await fetchApi<CertificateRequest[] | { data: CertificateRequest[] }>(
      apiClient.get(`/certificates/requests?requestorId=${studentId}`)
    );
    return Array.isArray(result) ? result : (result as { data: CertificateRequest[] }).data || [];
  },

  createRequest: async (data: {
    certificateTypeId: string;
    purpose?: string;
    fieldValues?: Record<string, unknown>;
  }): Promise<CertificateRequest> => {
    return fetchApi(
      apiClient.post('/certificates/requests', {
        ...data,
        requestorType: 'student',
      })
    );
  },

  getRequestDetail: async (id: string): Promise<CertificateRequest> => {
    return fetchApi(apiClient.get(`/certificates/requests/${id}`));
  },
};
