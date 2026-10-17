import { apiClient, fetchApi } from './client';

export interface LeaveRequest {
  _id: string;
  staffId: string;
  leaveType: string;
  leaveTypeName?: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  appliedAt: string;
  approvedBy?: { _id: string; displayName: string };
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface LeaveBalance {
  leaveType: string;
  leaveTypeName: string;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface PayslipSummary {
  _id: string;
  staffId: string;
  staffName?: string;
  month: number;
  year: number;
  monthLabel: string;
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  workingDays: number;
  daysPresent: number;
  lopDays: number;
  status: 'draft' | 'finalized' | 'disbursed';
  disbursementStatus?: 'pending' | 'paid' | 'failed';
  createdAt: string;
}

export interface PayslipDetail extends PayslipSummary {
  earnings: Array<{ code: string; label: string; amount: number }>;
  deductions: Array<{ code: string; label: string; amount: number }>;
  bankDetails?: {
    accountHolder?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
  };
  paymentDate?: string;
  paymentReference?: string;
}

export const hrApi = {
  // ===== Leaves =====
  getMyLeaves: async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: LeaveRequest[]; meta?: { total: number; totalPages: number } }> => {
    const qp = new URLSearchParams();
    if (params?.status) qp.append('status', params.status);
    if (params?.page) qp.append('page', String(params.page));
    if (params?.limit) qp.append('limit', String(params.limit));
    const response = await apiClient.get(`/hr/leaves/my?${qp.toString()}`);
    return response.data;
  },

  getLeaveBalance: async (): Promise<LeaveBalance[]> => {
    return fetchApi(apiClient.get('/hr/leaves/balance'));
  },

  applyLeave: async (data: {
    leaveType: string;
    fromDate: string;
    toDate: string;
    reason: string;
  }): Promise<LeaveRequest> => {
    return fetchApi(apiClient.post('/hr/leaves', data));
  },

  cancelLeave: async (id: string): Promise<void> => {
    await apiClient.delete(`/hr/leaves/${id}`);
  },

  // ===== Payslips =====
  getMyPayslips: async (params?: {
    year?: number;
    page?: number;
    limit?: number;
  }): Promise<{ data: PayslipSummary[]; meta?: { total: number; totalPages: number } }> => {
    const qp = new URLSearchParams();
    if (params?.year) qp.append('year', String(params.year));
    if (params?.page) qp.append('page', String(params.page));
    if (params?.limit) qp.append('limit', String(params.limit));
    const response = await apiClient.get(`/hr/payslips/my?${qp.toString()}`);
    return response.data;
  },

  getPayslipById: async (id: string): Promise<PayslipDetail> => {
    return fetchApi(apiClient.get(`/hr/payslips/${id}`));
  },
};
