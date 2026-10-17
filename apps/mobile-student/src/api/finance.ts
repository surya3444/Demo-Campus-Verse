import { apiClient, fetchApi } from '@campus-verse/mobile-shared/api/client';

export interface FeeAssignment {
  _id: string;
  studentId: string;
  feeStructureId: string;
  feeStructureName: string;
  academicYear: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  installments: Array<{
    installmentNumber: number;
    amount: number;
    dueDate: string;
    paidAmount: number;
    status: 'pending' | 'partial' | 'paid' | 'overdue';
  }>;
}

export interface FeeTransaction {
  _id: string;
  transactionNumber: string;
  studentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'cheque' | 'online' | 'upi' | 'card' | 'bank_transfer';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  receiptNumber?: string;
  remarks?: string;
  onlinePaymentId?: string;
  feeAssignmentId: string;
  createdAt: string;
}

export interface FeeStatement {
  student: {
    _id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    className: string;
    sectionName: string;
  };
  summary: {
    totalFees: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
  assignments: FeeAssignment[];
  transactions: FeeTransaction[];
}

export interface PaymentInitiateResponse {
  orderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
  notes: Record<string, string>;
}

export const financeApi = {
  // Get fee statement for a student
  // Built from the student-scoped endpoints: the finance report needs staff
  // permissions, so students got a 403 and an empty fees tab.
  getStudentStatement: async (studentId: string): Promise<Omit<FeeStatement, 'student'>> => {
    const [feeSummary, assignments] = await Promise.all([
      fetchApi<{
        summary: FeeStatement['summary'];
        transactions: Array<{
          _id: string;
          date: string;
          amount: number;
          mode: FeeTransaction['paymentMethod'];
          receiptNumber?: string;
        }>;
      }>(apiClient.get(`/students/${studentId}/fee-summary`)),
      fetchApi<FeeAssignment[]>(apiClient.get(`/finance/assignments/student/${studentId}`)),
    ]);
    return {
      summary: feeSummary.summary,
      assignments: assignments.map((a) => ({
        ...a,
        status: a.pendingAmount <= 0 ? 'paid' : a.paidAmount > 0 ? 'partial' : 'pending',
      })),
      transactions: feeSummary.transactions.map((t) => ({
        _id: t._id,
        transactionNumber: t.receiptNumber ?? '',
        studentId,
        amount: t.amount,
        paymentDate: t.date,
        paymentMethod: t.mode ?? 'cash',
        status: 'completed',
        receiptNumber: t.receiptNumber,
        feeAssignmentId: '',
        createdAt: t.date,
      })),
    };
  },

  // Get fee assignments for a student
  getStudentAssignments: async (studentId: string): Promise<FeeAssignment[]> => {
    return fetchApi(apiClient.get(`/finance/assignments/student/${studentId}`));
  },

  // Get payment history
  getTransactions: async (params?: {
    studentId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    transactions: FeeTransaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.studentId) queryParams.append('studentId', params.studentId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));

    return fetchApi(apiClient.get(`/finance/transactions?${queryParams.toString()}`));
  },

  // Initiate online payment (Razorpay)
  initiatePayment: async (data: {
    feeAssignmentId: string;
    amount: number;
    installmentNumber?: number;
  }): Promise<PaymentInitiateResponse> => {
    return fetchApi(apiClient.post('/finance/transactions/online-payment/initiate', data));
  },

  // Verify payment after Razorpay callback
  verifyPayment: async (data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<FeeTransaction> => {
    return fetchApi(apiClient.post('/finance/transactions/online-payment/verify', data));
  },

  // Download receipt
  getReceiptUrl: (transactionId: string): string => {
    return `/finance/transactions/${transactionId}/receipt`;
  },
};
