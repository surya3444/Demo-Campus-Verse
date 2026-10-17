import { BaseEntity } from './common';

export interface AuthorSnapshot {
  name: string;
  avatar?: string;
  roleCode: string;
  roleLabel: string;
}

export interface FeedMedia {
  url: string;
  type: 'image';
  width?: number;
  height?: number;
}

export type FeedAudience = 'everyone' | 'staff_only' | 'students_only';

export interface FeedComment {
  _id: string;
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  content: string;
  parentCommentId?: string;
  status: 'active' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export type FeedPostType = 'post' | 'notice';

export interface FeedPost extends BaseEntity {
  branchId: string;
  postType: FeedPostType;
  content: string;
  media: FeedMedia[];
  audience: FeedAudience;
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  likedBy: string[];
  likeCount: number;
  commentCount: number;
  comments: FeedComment[];
  isPinned: boolean;
  isFlagged: boolean;
  flaggedBy?: string;
  flaggedAt?: Date;
  flagReason?: string;
  status: 'active' | 'deleted';
  deletedBy?: string;
  deletedAt?: Date;
  // Computed field added by API
  isLikedByMe?: boolean;
}
