import { apiClient, fetchApi } from './client';

export interface FeedAuthor {
  userId?: string;
  name: string;
  avatar?: string;
  roleCode?: string;
  roleLabel?: string;
  roleLevel?: number;
}

export interface FeedMedia {
  url: string;
  type: 'image';
  width?: number;
  height?: number;
}

export interface FeedComment {
  _id: string;
  content: string;
  authorId: string;
  authorSnapshot: FeedAuthor;
  parentCommentId?: string | null;
  status: 'active' | 'deleted';
  createdAt: string;
  replies?: FeedComment[];
}

export interface FeedPost {
  _id: string;
  postType: 'post' | 'notice';
  content: string;
  media?: FeedMedia[];
  audience: 'everyone' | 'staff_only' | 'students_only';
  authorId: string;
  authorSnapshot: FeedAuthor;
  likeCount: number;
  commentCount: number;
  isLikedByMe?: boolean;
  isPinned?: boolean;
  isFlagged?: boolean;
  comments?: FeedComment[];
  status?: string;
  createdAt: string;
  updatedAt?: string;
}

export const feedApi = {
  getPosts: async (params?: {
    page?: number;
    limit?: number;
    postType?: 'post' | 'notice';
  }): Promise<{
    data: FeedPost[];
    meta?: { total: number; totalPages: number; hasMore: boolean };
  }> => {
    const qp = new URLSearchParams();
    if (params?.page) qp.append('page', String(params.page));
    if (params?.limit) qp.append('limit', String(params.limit));
    if (params?.postType) qp.append('postType', params.postType);
    const response = await apiClient.get(`/feed/posts?${qp.toString()}`);
    return response.data;
  },

  getPost: async (id: string): Promise<FeedPost> => {
    return fetchApi(apiClient.get(`/feed/posts/${id}`));
  },

  createPost: async (data: {
    content: string;
    media?: FeedMedia[];
    audience?: 'everyone' | 'staff_only' | 'students_only';
    postType?: 'post' | 'notice';
  }): Promise<FeedPost> => {
    return fetchApi(apiClient.post('/feed/posts', data));
  },

  deletePost: async (id: string): Promise<void> => {
    await apiClient.delete(`/feed/posts/${id}`);
  },

  toggleLike: async (id: string): Promise<{ isLikedByMe: boolean; likeCount: number }> => {
    return fetchApi(apiClient.post(`/feed/posts/${id}/like`));
  },

  addComment: async (
    postId: string,
    data: { content: string; parentCommentId?: string }
  ): Promise<FeedComment> => {
    return fetchApi(apiClient.post(`/feed/posts/${postId}/comments`, data));
  },

  deleteComment: async (postId: string, commentId: string): Promise<void> => {
    await apiClient.delete(`/feed/posts/${postId}/comments/${commentId}`);
  },
};
