import { Request, Response, NextFunction } from 'express';
import { blogService, type BlogStatus } from './blog.service';
import { success, created, noContent } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';

class BlogController {
  // ───────────── Public ─────────────

  async listPublished(req: Request, res: Response, next: NextFunction) {
    try {
      const { tag, page, limit } = req.query;
      const result = await blogService.listPublished({
        tag: tag as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const slug = req.params.slug as string;
      const post = await blogService.getPublishedBySlug(slug);
      success(res, post);
    } catch (error) {
      next(error);
    }
  }

  // ───────────── Admin ─────────────

  async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page, limit } = req.query;
      const result = await blogService.listAll({
        status: status as BlogStatus | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const post = await blogService.getById(id);
      success(res, post);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.superAdmin) throw new ApiError('UNAUTHORIZED', 'Not authenticated', 401);
      const post = await blogService.create(req.body, req.superAdmin.adminId);
      created(res, post, 'Blog post created');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const post = await blogService.update(id, req.body);
      success(res, post, undefined, 'Blog post updated');
    } catch (error) {
      next(error);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { status } = req.body as { status?: BlogStatus };
      if (status !== 'draft' && status !== 'published') {
        throw new ApiError('INVALID_INPUT', "status must be 'draft' or 'published'", 400);
      }
      const post = await blogService.setStatus(id, status);
      success(
        res,
        post,
        undefined,
        `Blog post ${status === 'published' ? 'published' : 'unpublished'}`
      );
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await blogService.remove(id);
      noContent(res);
    } catch (error) {
      next(error);
    }
  }

  async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderedIds } = req.body as { orderedIds?: string[] };
      if (!Array.isArray(orderedIds))
        throw new ApiError('INVALID_INPUT', 'orderedIds must be an array', 400);
      await blogService.reorder(orderedIds);
      success(res, { count: orderedIds.length }, undefined, 'Order updated');
    } catch (error) {
      next(error);
    }
  }

  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file as
        | (Express.Multer.File & { location?: string; key?: string })
        | undefined;
      if (!file) throw new ApiError('NO_FILE', 'No file uploaded', 400);
      created(res, { url: file.location, key: file.key }, 'Image uploaded');
    } catch (error) {
      next(error);
    }
  }
}

export const blogController = new BlogController();
