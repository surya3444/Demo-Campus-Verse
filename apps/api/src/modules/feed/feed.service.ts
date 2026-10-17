import { ObjectId, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';

interface AuthorInfo {
  userId: string;
  name: string;
  avatar?: string;
  roleCode: string;
  roleLevel: number;
}

function getRoleLabel(roleCode: string): string {
  const labels: Record<string, string> = {
    GROUP_OWNER: 'Owner',
    ORG_MODERATOR: 'Moderator',
    ORG_ADMIN: 'Admin',
    BRANCH_ADMIN: 'Admin',
    TEACHER: 'Teacher',
    HR_MANAGER: 'HR Manager',
    ACCOUNTANT: 'Accountant',
    ADMISSION_COUNSELOR: 'Counselor',
    RECEPTIONIST: 'Receptionist',
    STUDENT: 'Student',
  };
  return labels[roleCode] || 'Staff';
}

class FeedService {
  async getPosts(
    tenantId: string,
    branchId: string,
    query: Record<string, unknown>,
    currentUser: AuthorInfo
  ) {
    const { page, limit } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    // Audience filtering based on role
    if (currentUser.roleCode === 'STUDENT') {
      filter.audience = { $in: ['everyone', 'students_only'] };
    } else if (currentUser.roleLevel <= 15) {
      // Staff roles: see everyone + staff_only
      filter.audience = { $in: ['everyone', 'staff_only'] };
    }

    // Post type filter — existing posts without postType are treated as 'post'
    if (query.postType === 'notice') {
      filter.postType = 'notice';
    } else if (query.postType === 'post') {
      filter.postType = { $in: ['post', null] };
    }

    // Optional author filter
    if (query.authorId) {
      filter.authorId = new ObjectId(query.authorId as string);
    }

    const [data, total] = await Promise.all([
      collections.feedPosts
        .find(filter)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .project({
          comments: { $slice: -3 }, // Only last 3 comments in list view
          likedBy: 1,
          likeCount: 1,
          commentCount: 1,
          postType: 1,
          content: 1,
          media: 1,
          audience: 1,
          authorId: 1,
          authorSnapshot: 1,
          isPinned: 1,
          isFlagged: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .toArray(),
      collections.feedPosts.countDocuments(filter),
    ]);

    // Add isLikedByMe field
    const userId = new ObjectId(currentUser.userId);
    const enriched = data.map((post) => ({
      ...post,
      isLikedByMe: (post.likedBy || []).some((id: ObjectId) => id.toString() === userId.toString()),
      likedBy: undefined, // Don't send full array in list
    }));

    return { data: enriched, meta: buildPaginationMeta(page, limit, total) };
  }

  async getPostById(tenantId: string, id: string, currentUserId: string) {
    const post = await collections.feedPosts.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!post) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    // Filter out deleted comments
    if (post.comments) {
      post.comments = post.comments.filter((c: { status: string }) => c.status === 'active');
    }

    const userId = new ObjectId(currentUserId);
    return {
      ...post,
      isLikedByMe: (post.likedBy || []).some((id: ObjectId) => id.toString() === userId.toString()),
    };
  }

  async createPost(
    tenantId: string,
    branchId: string,
    data: {
      postType?: string;
      content: string;
      media?: Array<{ url: string; type: string; width?: number; height?: number }>;
      audience?: string;
    },
    author: AuthorInfo
  ) {
    // Only staff can create notices
    if (data.postType === 'notice' && author.roleLevel > 15) {
      throw new ApiError('FORBIDDEN', 'Only staff can post notices', 403);
    }

    const now = new Date();

    // Build author snapshot
    const authorSnapshot = {
      name: author.name,
      avatar: author.avatar,
      roleCode: author.roleCode,
      roleLabel: getRoleLabel(author.roleCode),
    };

    const doc = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      postType: data.postType || 'post',
      content: data.content,
      media: data.media || [],
      audience: data.audience || 'everyone',
      authorId: new ObjectId(author.userId),
      authorSnapshot,
      likedBy: [],
      likeCount: 0,
      commentCount: 0,
      comments: [],
      isPinned: false,
      isFlagged: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.feedPosts.insertOne(doc);
    return { _id: result.insertedId, ...doc, isLikedByMe: false };
  }

  async updatePost(
    tenantId: string,
    id: string,
    data: { content: string },
    currentUserId: string,
    isAdmin: boolean
  ) {
    const post = await collections.feedPosts.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!post) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    // Only own post or admin
    if (!isAdmin && post.authorId.toString() !== currentUserId) {
      throw new ApiError('FORBIDDEN', 'You can only edit your own posts', 403);
    }

    const result = await collections.feedPosts.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { content: data.content, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    return result;
  }

  async deletePost(tenantId: string, id: string, currentUserId: string, isAdmin: boolean) {
    const post = await collections.feedPosts.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!post) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    // Only own post or admin
    if (!isAdmin && post.authorId.toString() !== currentUserId) {
      throw new ApiError('FORBIDDEN', 'You can only delete your own posts', 403);
    }

    await collections.feedPosts.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'deleted',
          deletedBy: new ObjectId(currentUserId),
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return { message: 'Post deleted' };
  }

  async toggleLike(tenantId: string, id: string, userId: string) {
    const post = await collections.feedPosts.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!post) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    const userObjId = new ObjectId(userId);
    const isLiked = (post.likedBy || []).some((lid: ObjectId) => lid.toString() === userId);

    if (isLiked) {
      await collections.feedPosts.updateOne({ _id: new ObjectId(id) }, {
        $pull: { likedBy: userObjId },
        $inc: { likeCount: -1 },
        $set: { updatedAt: new Date() },
      } as unknown as UpdateFilter<Document>);
      return { liked: false, likeCount: Math.max(0, (post.likeCount || 0) - 1) };
    } else {
      await collections.feedPosts.updateOne({ _id: new ObjectId(id) }, {
        $addToSet: { likedBy: userObjId },
        $inc: { likeCount: 1 },
        $set: { updatedAt: new Date() },
      } as unknown as UpdateFilter<Document>);
      return { liked: true, likeCount: (post.likeCount || 0) + 1 };
    }
  }

  async addComment(
    tenantId: string,
    postId: string,
    data: { content: string; parentCommentId?: string },
    author: AuthorInfo
  ) {
    const post = await collections.feedPosts.findOne({
      _id: new ObjectId(postId),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!post) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    if ((post.comments || []).length >= 100) {
      throw new ApiError('LIMIT_REACHED', 'Maximum 100 comments per post', 400);
    }

    // Validate parent comment exists if replying
    if (data.parentCommentId) {
      const parentExists = (post.comments || []).some(
        (c: { _id: ObjectId; status: string }) =>
          c._id.toString() === data.parentCommentId && c.status === 'active'
      );
      if (!parentExists) {
        throw new ApiError('NOT_FOUND', 'Parent comment not found', 404);
      }
    }

    const now = new Date();
    const comment = {
      _id: new ObjectId(),
      authorId: new ObjectId(author.userId),
      authorSnapshot: {
        name: author.name,
        avatar: author.avatar,
        roleCode: author.roleCode,
        roleLabel: getRoleLabel(author.roleCode),
      },
      content: data.content,
      parentCommentId: data.parentCommentId ? new ObjectId(data.parentCommentId) : undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await collections.feedPosts.updateOne({ _id: new ObjectId(postId) }, {
      $push: { comments: comment },
      $inc: { commentCount: 1 },
      $set: { updatedAt: now },
    } as unknown as UpdateFilter<Document>);

    return comment;
  }

  async deleteComment(
    tenantId: string,
    postId: string,
    commentId: string,
    currentUserId: string,
    isAdmin: boolean
  ) {
    const post = await collections.feedPosts.findOne({
      _id: new ObjectId(postId),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!post) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    const comment = (post.comments || []).find(
      (c: { _id: ObjectId }) => c._id.toString() === commentId
    );

    if (!comment || comment.status === 'deleted') {
      throw new ApiError('NOT_FOUND', 'Comment not found', 404);
    }

    // Only own comment or admin
    if (!isAdmin && comment.authorId.toString() !== currentUserId) {
      throw new ApiError('FORBIDDEN', 'You can only delete your own comments', 403);
    }

    // Mark as deleted (keep for thread integrity)
    await collections.feedPosts.updateOne(
      {
        _id: new ObjectId(postId),
        'comments._id': new ObjectId(commentId),
      },
      {
        $set: {
          'comments.$.status': 'deleted',
          'comments.$.content': '[Comment deleted]',
          'comments.$.updatedAt': new Date(),
          updatedAt: new Date(),
        },
        $inc: { commentCount: -1 },
      } as unknown as UpdateFilter<Document>
    );

    return { message: 'Comment deleted' };
  }

  async togglePin(tenantId: string, id: string) {
    const post = await collections.feedPosts.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });

    if (!post) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    const result = await collections.feedPosts.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { isPinned: !post.isPinned, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    return { isPinned: result!.isPinned };
  }

  async flagPost(tenantId: string, id: string, data: { reason: string }, userId: string) {
    const result = await collections.feedPosts.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        status: 'active',
      },
      {
        $set: {
          isFlagged: true,
          flaggedBy: new ObjectId(userId),
          flaggedAt: new Date(),
          flagReason: data.reason,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    return { message: 'Post flagged for review' };
  }

  async moderateDelete(tenantId: string, id: string, userId: string) {
    const result = await collections.feedPosts.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        status: 'active',
      },
      {
        $set: {
          status: 'deleted',
          deletedBy: new ObjectId(userId),
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('NOT_FOUND', 'Post not found', 404);
    }

    return { message: 'Post removed by moderator' };
  }

  async getFlaggedPosts(tenantId: string, branchId: string, query: Record<string, unknown>) {
    const { page, limit } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
      isFlagged: true,
    };

    const [data, total] = await Promise.all([
      collections.feedPosts.find(filter).sort({ flaggedAt: -1 }).skip(skip).limit(limit).toArray(),
      collections.feedPosts.countDocuments(filter),
    ]);

    return { data, meta: buildPaginationMeta(page, limit, total) };
  }
}

export const feedService = new FeedService();
