import { apiClient, fetchApi } from './client';

export type FeedbackCategory =
  | 'academic'
  | 'infrastructure'
  | 'hostel'
  | 'finance'
  | 'hr'
  | 'safety'
  | 'harassment'
  | 'other';

export type FeedbackPriority = 'low' | 'medium' | 'high' | 'urgent';

export type FeedbackStatus =
  | 'open'
  | 'in_progress'
  | 'escalated'
  | 'resolved'
  | 'reopened'
  | 'closed';

export interface FeedbackResponse {
  _id: string;
  message: string;
  respondedBy: string;
  respondedByName: string;
  isInternal: boolean;
  createdAt: string;
}

export interface FeedbackSatisfaction {
  rating: number;
  comment?: string | null;
  submittedAt: string;
}

export interface FeedbackTicket {
  _id: string;
  tenantId: string;
  branchId: string;
  ticketNumber: string;
  submittedBy: string | null;
  submitterType: 'student' | 'staff';
  submitterName: string;
  isAnonymous: boolean;
  subject: string;
  description: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedAt?: string | null;
  responses: FeedbackResponse[];
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
  satisfaction?: FeedbackSatisfaction | null;
  escalatedAt?: string | null;
  closedAt?: string | null;
  reopenedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackStats {
  total: number;
  open: number;
  inProgress: number;
  escalated: number;
  resolved: number;
  closed: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
}

export interface FeedbackListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  priority?: FeedbackPriority;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const feedbackApi = {
  getTickets: async (
    params?: FeedbackListParams
  ): Promise<{
    data: FeedbackTicket[];
    meta: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
  }> => {
    const qp = new URLSearchParams();
    if (params?.page) qp.append('page', String(params.page));
    if (params?.limit) qp.append('limit', String(params.limit));
    if (params?.search) qp.append('search', params.search);
    if (params?.status) qp.append('status', params.status);
    if (params?.category) qp.append('category', params.category);
    if (params?.priority) qp.append('priority', params.priority);
    if (params?.sortBy) qp.append('sortBy', params.sortBy);
    if (params?.sortOrder) qp.append('sortOrder', params.sortOrder);
    const response = await apiClient.get(`/feedback?${qp.toString()}`);
    return response.data;
  },

  getTicket: async (id: string): Promise<FeedbackTicket> => {
    return fetchApi(apiClient.get(`/feedback/${id}`));
  },

  getStats: async (): Promise<FeedbackStats> => {
    return fetchApi(apiClient.get('/feedback/stats'));
  },

  createTicket: async (data: {
    subject: string;
    description: string;
    category: FeedbackCategory;
    priority?: FeedbackPriority;
    isAnonymous?: boolean;
  }): Promise<FeedbackTicket> => {
    return fetchApi(apiClient.post('/feedback', data));
  },

  updateTicket: async (
    id: string,
    data: {
      subject?: string;
      description?: string;
      category?: FeedbackCategory;
      priority?: FeedbackPriority;
    }
  ): Promise<FeedbackTicket> => {
    return fetchApi(apiClient.put(`/feedback/${id}`, data));
  },

  deleteTicket: async (id: string): Promise<void> => {
    await apiClient.delete(`/feedback/${id}`);
  },

  addResponse: async (
    id: string,
    data: { message: string; isInternal?: boolean }
  ): Promise<FeedbackTicket> => {
    return fetchApi(apiClient.post(`/feedback/${id}/responses`, data));
  },

  updateStatus: async (
    id: string,
    data: {
      status: 'in_progress' | 'resolved' | 'closed' | 'reopened';
      resolutionNote?: string;
    }
  ): Promise<FeedbackTicket> => {
    return fetchApi(apiClient.put(`/feedback/${id}/status`, data));
  },

  escalate: async (id: string): Promise<FeedbackTicket> => {
    return fetchApi(apiClient.put(`/feedback/${id}/escalate`));
  },

  submitSatisfaction: async (
    id: string,
    data: { rating: number; comment?: string }
  ): Promise<FeedbackTicket> => {
    return fetchApi(apiClient.put(`/feedback/${id}/satisfaction`, data));
  },
};
