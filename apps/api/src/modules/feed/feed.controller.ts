import { Request, Response, NextFunction } from 'express';
import { feedService } from './feed.service';
import { success, created } from '../../utils/response';
import { collections } from '../../config/database';
import { ObjectId } from 'mongodb';

function getAuthorInfo(req: Request) {
  const user = req.user!;
  return {
    userId: user.userId,
    name: user.email.split('@')[0], // fallback, will be enriched below
    avatar: undefined as string | undefined,
    roleCode: user.roleCode,
    roleLevel: user.roleLevel,
  };
}

async function enrichAuthorInfo(req: Request) {
  const info = getAuthorInfo(req);

  // Try to get display name from users collection
  const userDoc = await collections.users.findOne({
    _id: new ObjectId(info.userId),
  });

  if (userDoc) {
    info.name =
      userDoc.profile?.firstName && userDoc.profile?.lastName
        ? `${userDoc.profile.firstName} ${userDoc.profile.lastName}`
        : userDoc.profile?.firstName || userDoc.email?.split('@')[0] || info.name;
    info.avatar = userDoc.profile?.avatar;
  }

  return info;
}

function isAdmin(req: Request): boolean {
  return req.user!.roleLevel <= 3;
}

class FeedController {
  async getPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const author = getAuthorInfo(req);
      const result = await feedService.getPosts(
        req.tenantId!,
        req.branchId!,
        req.query as Record<string, unknown>,
        author
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getPostById(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await feedService.getPostById(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, post);
    } catch (error) {
      next(error);
    }
  }

  async createPost(req: Request, res: Response, next: NextFunction) {
    try {
      const author = await enrichAuthorInfo(req);
      const post = await feedService.createPost(req.tenantId!, req.branchId!, req.body, author);
      created(res, post, 'Post created successfully');
    } catch (error) {
      next(error);
    }
  }

  async updatePost(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await feedService.updatePost(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId,
        isAdmin(req)
      );
      success(res, post);
    } catch (error) {
      next(error);
    }
  }

  async deletePost(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feedService.deletePost(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId,
        isAdmin(req)
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async toggleLike(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feedService.toggleLike(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const author = await enrichAuthorInfo(req);
      const comment = await feedService.addComment(
        req.tenantId!,
        req.params.id as string,
        req.body,
        author
      );
      created(res, comment, 'Comment added');
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feedService.deleteComment(
        req.tenantId!,
        req.params.id as string,
        req.params.commentId as string,
        req.user!.userId,
        isAdmin(req)
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async togglePin(req: Request, res: Response, next: NextFunction) {
    try {
      if (!isAdmin(req)) {
        return res
          .status(403)
          .json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only admins can pin posts' },
          });
      }
      const result = await feedService.togglePin(req.tenantId!, req.params.id as string);
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async flagPost(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await feedService.flagPost(
        req.tenantId!,
        req.params.id as string,
        req.body,
        req.user!.userId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async moderateDelete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!isAdmin(req)) {
        return res
          .status(403)
          .json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only admins can moderate posts' },
          });
      }
      const result = await feedService.moderateDelete(
        req.tenantId!,
        req.params.id as string,
        req.user!.userId
      );
      success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getFlaggedPosts(req: Request, res: Response, next: NextFunction) {
    try {
      if (!isAdmin(req)) {
        return res
          .status(403)
          .json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only admins can view flagged posts' },
          });
      }
      const result = await feedService.getFlaggedPosts(
        req.tenantId!,
        req.branchId!,
        req.query as Record<string, unknown>
      );
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

export const feedController = new FeedController();
